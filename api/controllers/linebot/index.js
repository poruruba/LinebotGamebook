'use strict';

const IMAGE_URL_BASE = "https://garden.poruru.site:10443/linebot_image/";
const AUDIO_URL_BASE = "https://garden.poruru.site:10443/gamebook/audio/";

const line = require('@line/bot-sdk');
const mm = require('music-metadata');
const sharp = require('sharp');

const HELPER_BASE = process.env.HELPER_BASE || '../../helpers/';
const BinResponse = require(HELPER_BASE + 'binresponse');

const AWS_ENABLE = false;
const FILE_ENABLE = true;

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};
const LineUtils = require(HELPER_BASE + 'line-utils');
const app = new LineUtils(line, config);

const DEFAULT_SCENARIO = process.env.DEFAULT_SCENARIO || 'scenario0';
const DEFAULT_SCENE = process.env.DEFAULT_SCENE || '0';

/* S3用 */
const CONTENTS_BUCKET = process.env.CONTENTS_BUCKET || 'gamebook';
const SCENARIO_OBJECT_BASE = 'scenario/';
const AUDIO_OBJECT_BASE = 'audio/';

/* DynamoDB用 */
const TABLE_NAME = process.env.TABLE_NAME || "gamebook";

/* ファイル用 */
const SCENARIO_FILE_BASE = './data/gamebook/scenario/';
const STATE_FILE_BASE = './data/gamebook/users/';
const AUDIO_FILE_BASE = './public/gamebook/audio/';
const IMAGE_FILE_BASE = './public/gamebook/images/';
const fs = require('fs').promises;

const AWS = require("aws-sdk");
AWS.config.update({
  region: "ap-northeast-1",
});
const docClient = new AWS.DynamoDB.DocumentClient({
});
var s3  = new AWS.S3({
});

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

async function load_audio(fname){
  if( AWS_ENABLE ){
    // S3用
    var param_get = {
      Bucket: CONTENTS_BUCKET,
      Key: AUDIO_OBJECT_BASE + fname
    };
    var image = await s3.getObject(param_get).promise();
    return image.Body;
  }
  if( FILE_ENABLE ){
    // ファイル用
    return await fs.readFile(AUDIO_FILE_BASE + fname);
  }
}

async function load_status(userid){
  if( AWS_ENABLE ){
    // DynamoDB用
    var params_get = {
      TableName: TABLE_NAME,
      Key: {
        userid: userid,
      }
    };
    var result = await docClient.get(params_get).promise();
    return result.Item;
  }
  if( FILE_ENABLE ){
    // ファイル用
    try{
      var status = await fs.readFile(STATE_FILE_BASE + userid + '.json', 'utf8');
      return JSON.parse(status);
    }catch(error){
      return undefined;
    }
  }
}

async function create_status(userid, scenario, scene){
  return {
    userid: userid,
    scenario: scenario,
    scene: scene,
    turn: 0,
    items: [],
  };
}

async function insert_status(status){
  if( AWS_ENABLE ){
    // DynamoDB用
    var params_put = {
      TableName: TABLE_NAME,
      Item: status
    };
    return await docClient.put(params_put).promise();
  }
  if( FILE_ENABLE ){
    // ファイル用
    return fs.writeFile(STATE_FILE_BASE + status.userid + '.json', JSON.stringify(status), 'utf8');
  }
}

async function update_status(status){
  if( AWS_ENABLE ){
    // DynamoDB用
    var params_update = {
      TableName: TABLE_NAME,
      Key: {
        userid: status.userid
      },
      ExpressionAttributeNames: {
        '#attr1': 'scenario',
        '#attr2': 'scene',
        '#attr3': 'items',
        '#attr4': 'turn',
      },
      ExpressionAttributeValues: {
        ':attrValue1': status.scenario,
        ':attrValue2': status.scene,
        ':attrValue3': status.items,
        ':attrValue4': status.turn,
      },
      UpdateExpression: 'SET #attr1 = :attrValue1, #attr2 = :attrValue2, #attr3 = :attrValue3 , #attr4 = :attrValue4',
      ConditionExpression: "attribute_exists(userid)",
      ReturnValues:"ALL_NEW"
    };
    return await docClient.update(params_update).promise();
  }
  if( FILE_ENABLE ){
    // ファイル用
    return insert_status(status);
  }
}

function add_item(item_list, item){
  if( item_list.indexOf(item) >= 0 )
    return false;
  
  item_list.push(item);
  return true;
}

function remove_item(item_list, item){
  var index = item_list.indexOf(item);
  if( index < 0 )
    return false;

  item_list.splice(index, 1);
  return true;
}

function has_item(item_list, item){
  return ( item_list.indexOf(item) >= 0 );
}

function check_condition(items, have, nothave){
  var condition = true;

  // haveのアイテムの所持確認
  if( have ){
    have.forEach( item => {
      if( !has_item(items, item ) ){
        condition = false;
        return;
      }
    });
  }
  // nothaveのアイテムの非所持確認
  if( nothave ){
    nothave.forEach( item => {
      if( has_item(items, item ) ){
        condition = false;
        return;
      }
    });
  }

  return condition;
}

app.message(async (event, client) =>{
  try{
    console.log(event);

    var cmd_processed = false;

    // userIdのステータスをDBから取得
    var status = await load_status(event.source.userId);
    if( !status ){
      // 初めてのuserIdの場合はステータスを生成
      status = await create_status(event.source.userId, DEFAULT_SCENARIO, DEFAULT_SCENE);
      // DBに同期
      await insert_status(status);
    }

    if( event.message.text == 'ヘルプ'){
      // コマンド：ヘルプ
      var message = {
        type: "text",
        text: "コマンドリスト\n  リタイア：最初からやり直し\n  リセット：今のシナリオの最初に戻る\n  リロード：再表示\n  持ち物：持ち物の確認\n  ステータス：シナリオ名の確認",
        quickReply: {
          items: [
            {
              type: 'action',
              action: {
                type: "message",
                label: "リセット",
                text: "リセット"
              }
            },
            {
              type: 'action',
              action: {
                type: "message",
                label: "リロード",
                text: "リロード"
              }
            },
            {
              type: 'action',
              action: {
                type: "message",
                label: "持ち物",
                text: "持ち物"
              }
            },
            {
              type: 'action',
              action: {
                type: "message",
                label: "ステータス",
                text: "ステータス"
              }
            },
          ]
        }
      };
      return client.replyMessage(event.replyToken, message);
    }

    var com_list = event.message.text.split(' ');

    switch(com_list[0]){
      case 'リタイア':{
        // コマンド：リタイア
        status = await create_status(event.source.userId, DEFAULT_SCENARIO, DEFAULT_SCENE);
        cmd_processed = true;
        break;
      }
      case 'リセット':{
        // コマンド：リセット
        status.scene = DEFAULT_SCENE;
        status.items = [];
        cmd_processed = true;
        break;
      }
      case 'リロード':{
        // コマンド：リロード
        cmd_processed = true;
        break;
      }
      case 'scenario':{
        // シナリオの変更
        if( parseInt(com_list[2]) != (status.turn + 1) )
          throw "turn is invalid";
        status.scenario = com_list[1];
        status.scene = DEFAULT_SCENE;
        cmd_processed = true;
        break;
      }
      case 'scene':{
        // シーンの変更
        if( parseInt(com_list[2]) != (status.turn + 1))
          throw "turn is invalid";
        status.scene = com_list[1];
        cmd_processed = true;
        break;
      }
    }

    // ターン番号をインクリメント
    status.turn++;

    // 現在のシナリオを取得
    let scenario = await load_scenario(status.scenario + '.json');
    if( !scenario )
      throw "scenario not found";
    
    scenario = JSON.parse(scenario);

    // 現在のシーンを取得
    var scene = scenario.scene.find(item => item.id == status.scene );
    if( !scene )
      throw "scene not found";

    if( event.message.text == '持ち物' || event.message.text == 'もちもの'){
      // コマンド：持ち物
      var message = {
        type: "text",
        text: "現在の持ち物"
      };
      if( status.items.length > 0 ){
        status.items.forEach( item =>{
          message.text += "\n・" + item;
        });
      }else{
        message.text += "はありません";
      }
      cmd_processed = true;
      return client.replyMessage(event.replyToken, message);
    }else
    if( event.message.text == 'ステータス'){
      // コマンド：ステータス
      var message = {
        type: "text",
        text: "シナリオ名：" + scenario.title + "\nシーン番号：" + status.scene,
      };
      cmd_processed = true;
      return client.replyMessage(event.replyToken, message);
    }
    
    var messages = [];

    if(!cmd_processed ){
      // 不明なコマンド
      var message = {
        type: "text",
        text: "不明なコマンド",
      };
      messages.push(message);
    }

    // 獲得アイテムの処理
    if(scene.acquire && scene.acquire.length > 0){
      scene.acquire.forEach(item => add_item(status.items, item));
      var message = {
        type: "text",
        text: scene.acquire.join('、') + "を手に入れた"
      }
      messages.push(message);
    }

    // ロストアイテムの処理
    if( scene.lost && scene.lost.length > 0){
      scene.lost.forEach(item => remove_item(status.items, item));
      var message = {
        type: "text",
        text: scene.lost.join('、') + "を失った"
      };
      messages.push(message);
    }

    // メインダイアログ
    var flex = {
      type: "flex",
      altText: scene.text,
      contents: {
        type: "bubble",
        size: "kilo",
        body: {
          type: "box",
          layout: "vertical",
          contents: [],
        },
        footer:{
          type: "box",
          layout: "vertical",
          contents:[],
          flex: 0
        }
      }
    };

    if( scene.image && scene.image.background ){
      // 画像が指定されていた場合
      var image_url = IMAGE_URL_BASE + scene.image.background;
      // 画像合成が指定されていた場合
      if(scene.image.composite ){
        scene.image.composite.forEach( select => {
          if( !select.name )
            return;

          // アイテムの所持・非所持確認
          var condition = check_condition(status.items, select.have, select.nothave );
          if( !condition )
            return;

          // 合成画像の指定追加
          image_url += '-' + select.name;
          if( select.position != undefined )
            image_url += '_' + select.position;
        });
      }
      flex.contents.hero = {
        type: "image",
        url: encodeURI(image_url),
        size: "full",
        aspectRatio: "20:13",
        aspectMode: "fit"
      };
    }

    if( scene.title ){
      // タイトルが指定されていた場合
      flex.contents.body.contents.push({
        type: "text",
        wrap: true,
        text: scene.title,
        weight: "bold",
        size: "md"
      });
    }

    // テキストの設定
    flex.contents.body.contents.push({
      type: "text",
      wrap: true,
      size: "sm",
      text: scene.text
    });

    // 次の選択肢
    if( scene.selection ){
      scene.selection.forEach( select =>{
        if( !select.id )
          return;
          
        // アイテムの所持・非所持確認
        var condition = check_condition(status.items, select.have, select.nothave );
        if( !condition )
          return;

        // 選択肢の追加
        var type = "scene";
        if( select.type )
          type = select.type;

        flex.contents.footer.contents.push({
          type: "button",
          style: "link",
          height: "sm",
          action:{
            type: "message",
            label: select.title + '(' + select.id + ')',
            text: type + " " + select.id + " " + (status.turn + 1)
          }
        })
      });
    }
    if( flex.contents.footer.contents.length == 0 ){
      flex.contents.footer.contents.push({
        type: "button",
        style: "link",
        height: "sm",
        action:{
          type: "message",
          label: "シナリオの最初に戻る",
          text: "リセット"
        }
      });
      flex.contents.footer.contents.push({
        type: "button",
        style: "link",
        height: "sm",
        action:{
          type: "message",
          label: "最初から始める",
          text: "リタイア"
        }
      });
    }
    messages.push(flex);

    if( scene.audio && scene.audio.name ){
      // 音声ファイルが指定されていた場合
      // アイテムの所持・非所持確認
      var condition = check_condition(status.items, scene.audio.have, scene.audio.nothave );
      if( condition ){
        var audio_buffer = await load_audio(scene.audio.name + '.m4a');
        var metadata = await mm.parseBuffer(audio_buffer, "audio/aac")
        var message = {
          type: "audio",
          originalContentUrl: encodeURI(AUDIO_URL_BASE + scene.audio.name + '.m4a'),
          duration: Math.floor(metadata.format.duration * 1000) 
        };
        messages.push(message);
      }
    }

    //userIdのステータスをDBに更新
    console.log(status);
    update_status(status);

    // メッセージの一括送信
    console.log(messages);
    console.log(JSON.stringify(messages));
    return client.replyMessage(event.replyToken, messages);
  }catch(error){
    console.error(error);
    var message = {
      type: "text",
      text: error.toString()
    };
    return client.replyMessage(event.replyToken, message);
  }
});

exports.fulfillment = app.lambda();

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
  }
};
