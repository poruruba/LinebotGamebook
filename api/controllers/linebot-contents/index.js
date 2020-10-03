'use strict';

const HELPER_BASE = process.env.HELPER_BASE || '../../helpers/';
const Response = require(HELPER_BASE + 'response');
const BinResponse = require(HELPER_BASE + 'binresponse');

const sharp = require('sharp');

const AWS_ENABLE = false;
const FILE_ENABLE = true;

// S3用
const CONTENTS_BUCKET = process.env.CONTENTS_BUCKET || 'gamebook';
const SCENARIO_OBJECT_BASE = 'scenario/'
const IMAGE_OBJECT_BASE = 'images/'
const AUDIO_OBJECT_BASE = 'audio/'

var AWS = require('aws-sdk');
AWS.config.update({
  region: "ap-northeast-1",
});
var s3  = new AWS.S3({
});

// ファイル用
const IMAGE_FILE_BASE = './public/gamebook/images/';
const AUDIO_FILE_BASE = './public/gamebook/audio/';
const SCENARIO_FILE_BASE = './data/gamebook/scenario/';
const fs = require('fs').promises;

async function load_image(name){
  if( AWS_ENABLE ){
    // S3用
    var param_get = {
      Bucket: CONTENTS_BUCKET,
      Key: IMAGE_OBJECT_BASE + name + ".png"
    };
    var image = await s3.getObject(param_get).promise();
    return image.Body;
  }
  if( FILE_ENABLE ){
    // ファイル用
    return fs.readFile(IMAGE_FILE_BASE + name + ".png");
  }
}

async function load_scenario(fname){
  if( AWS_ENABLE ){
    // S3用
    var param_get = {
      Bucket: CONTENTS_BUCKET,
      Key: SCENARIO_OBJECT_BASE + fname
    };
    var obj = await s3.getObject(param_get).promise();
    return obj.Body;
  }
  if( FILE_ENABLE ){
    // ファイル用
    return await fs.readFile(SCENARIO_FILE_BASE + fname, "utf-8");
  }
}

async function update_object(type, fname, body){
  if( AWS_ENABLE ){
    // S3用
    var key;
    if( type == 'image' ) key = IMAGE_OBJECT_BASE;
    else if( type == 'audio' ) key = AUDIO_OBJECT_BASE;
    else if( type == 'scenario' ) key = SCENARIO_OBJECT_BASE;

    var param_put = {
      Bucket: CONTENTS_BUCKET,
      Key: key + fname,
      Body: body
    };

    await s3.putObject(param_put).promise();
  }
  if( FILE_ENABLE ){
    // ファイル用
    var base;
    if( type == 'image' ) base = IMAGE_FILE_BASE;
    else if( type == 'audio' ) base = AUDIO_FILE_BASE;
    else if( type == 'scenario' ) base = SCENARIO_FILE_BASE;

    await fs.writeFile(base + fname, body);
  }
}

async function delete_file(type, fname){
  if( AWS_ENABLE ){
    // S3用
    var key;
    if( type == 'image' ) key = IMAGE_OBJECT_BASE;
    else if( type == 'audio' ) key = AUDIO_OBJECT_BASE;
    else if( type == 'scenario' ) key = SCENARIO_OBJECT_BASE;
    var param_delete = {
      Bucket: CONTENTS_BUCKET,
      Key: key + fname
    };

    var param_delete = {
      Bucket: CONTENTS_BUCKET,
      Prefix: key
    };
    await s3.deleteObject(param_delete).promise();
  }
  if( FILE_ENABLE ){
    // ファイル用
    var base;
    if( type == 'image' ) base = IMAGE_FILE_BASE;
    else if( type == 'audio' ) base = AUDIO_FILE_BASE;
    else if( type == 'scenario' ) base = SCENARIO_FILE_BASE;

    await fs.unlink(base + fname);
  }
}

async function list_files(type){
  if( AWS_ENABLE ){
    // S3用
    var key;
    if( type == 'image' ) key = IMAGE_OBJECT_BASE;
    else if( type == 'audio' ) key = AUDIO_OBJECT_BASE;
    else if( type == 'scenario' ) key = SCENARIO_OBJECT_BASE;

    var param_list = {
      Bucket: CONTENTS_BUCKET,
      Prefix: key
    };
    var ret = await s3.listObjectsV2(param_list).promise();
    var list = [];
    ret.Contents.forEach(item => {
      list.push(item.Key.slice(key.length));
    });
    return list;
  }
  if( FILE_ENABLE ){
    //ファイル用
    var base;
    if( type == 'image' ) base = IMAGE_FILE_BASE;
    else if( type == 'audio' ) base = AUDIO_FILE_BASE;
    else if( type == 'scenario' ) base = SCENARIO_FILE_BASE;

    var files = await fs.readdir(base);
    const list = [];
    for( var i = 0 ; i < files.length ; i++ ){
      const stats = await fs.stat(base + files[i]);
      if( stats.isDirectory() )
        continue;
      list.push(files[i]);
    }
    return list;
  }
}

exports.handler = async (event, context, callback) => {
  console.log(event);
  if( event.path.startsWith('/linebot-image/') ){
    var paths = decodeURIComponent(event.path).split('/');
    var words = paths[2].split('-');

    const image_buffer = await load_image(words[0]);
    const image = sharp(image_buffer);
    const image_meta = await image.metadata();
    var width = image_meta.width;
    var unit = width / 12.0;

    var list = [];
    for( var i = 1 ; i < words.length ; i++ ){
      var params = words[i].split('_');
      const add_buffer = await load_image(params[0]);
      const add = sharp(add_buffer);
      const add_meta = await add.metadata();

      var position = ( params.length > 1 ) ? parseInt(params[1]) : 6;
      var left = Math.floor(position * unit - unit / 2 - add_meta.width / 2);

      list.push({
        input: add_buffer,
        left : (left < 0) ? 0 : left,
        top: (add_meta.height < image_meta.height ) ? (image_meta.height - add_meta.height) : 0,
      })
    }
    image.composite(list);

    return image.toBuffer()
    .then(buffer =>{
      return new BinResponse('image/png', buffer);
    });
  }else{
    switch( event.path ){
      case '/linebot-upload':{
        var body = JSON.parse(event.body);
        var ext;
        if( body.type == 'image') ext = '.png';
        else if( body.type == 'audio') ext = '.m4a';
        else return new Response().set_error('unknown type');

        var fname = event.files.upfile[0].originalname;
        if( fname.endsWith(ext.toUpperCase()) )
          fname = fname.slice(0, -4) + ext;
        if( !fname.endsWith(ext))
          fname += ext;
        await update_object(body.type, fname, event.files.upfile[0].buffer);
        return new Response({ result: 'OK'});
      }
      case '/linebot-contents':{
        var body = JSON.parse(event.body);
        if( body.cmd == 'list' ){
          var list = await list_files(body.type);
          if( body.type == 'image' || body.type == 'audio'){
            for( var i = 0 ; i < list.length ; i++ )
              list[i] = list[i].slice(0, -4);
          }
          return new Response(list);
        }else
        if( body.cmd == 'delete' ){
          var fname;
          if( body.type == 'image') fname = body.name + '.png';
          else if( body.type == 'audio') fname = body.name + '.m4a';
          else fname = body.fname;
          await delete_file(body.type, fname);
          return new Response({ result: 'OK'});
        }
        if( body.type == 'scenario'){
          switch(body.cmd){
            case 'create':
            case 'update':{
              await update_object('scenario', body.fname, JSON.stringify(body.scenario, 0, 2));
              return new Response({});
            }
            case 'download':{
              var scenario = await load_scenario(body.fname);
              return new Response(JSON.parse(scenario));
            }
          }
        }
        break;
      }
    }
  }
};
