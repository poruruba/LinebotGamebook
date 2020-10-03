'use strict';

const sharp = require('sharp');

const HELPER_BASE = process.env.HELPER_BASE || '../../helpers/';
const BinResponse = require(HELPER_BASE + 'binresponse');

// S3用
const IMAGE_BUCKET = process.env.IMAGE_BUCKET || 'gamebook';
const IMAGE_OBJECT_BASE = 'images/'

var AWS = require('aws-sdk');
AWS.config.update({
  region: "ap-northeast-1",
});
var s3  = new AWS.S3({
});

// ファイル用
const IMAGE_FILE_BASE = './public/gamebook/images/';
const fs = require('fs').promises;

async function load_image(name){
/*
  // S3用
  var param_get = {
    Bucket: IMAGE_BUCKET,
    Key: IMAGE_OBJECT_BASE + name + ".png"
  };
  var image = await s3.getObject(param_get).promise();
  return image.Body;
*/
  // ファイル用
  return fs.readFile(IMAGE_FILE_BASE + name + ".png");
}

exports.handler = async (event, context, callback) => {
  console.log(event);

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
};


