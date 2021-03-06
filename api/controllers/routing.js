'use strict';

const CONTROLLERS_BASE = './api/controllers/';
const TARGET_FNAME = "swagger.yaml";

const express = require('express');
const router = express.Router();

const fs = require('fs');
const yaml = require('yaml');
const multer = require('multer');
const jwt_decode = require('jwt-decode');

const func_table = [];

const folders = fs.readdirSync(CONTROLLERS_BASE);
folders.forEach(folder => {
  const stats_dir = fs.statSync(CONTROLLERS_BASE + folder);
  if( !stats_dir.isDirectory() )
        return;
  try{
    const fname = CONTROLLERS_BASE + folder + "/" + TARGET_FNAME;
    fs.statSync(fname);

    const swagger = yaml.parseDocument(fs.readFileSync(fname, 'utf-8'));
    const paths = swagger.get('paths');
    paths.items.forEach(docPath =>{
      const path = docPath.key.value;
      docPath.value.items.forEach(docMethod =>{
        const method = docMethod.key.value;

        const options = {
          operationId : folder,
          func_type: 'normal',
          content_type: 'application/json',
          files: []
        };

        const docHandler = docMethod.value.items.filter(item => item.key.value == 'x-handler' );
        let handler = 'handler';
        if( docHandler.length == 1 )
          handler = docHandler[0].value.value;

        const docSecurity = docMethod.value.items.filter(item => item.key.value == 'security' );
        if( docSecurity.length == 1 && docSecurity[0].value.items.length == 1 && docSecurity[0].value.items[0].items.length == 1)
          options.security = docSecurity[0].value.items[0].items[0].key.value;

        const docFuncType = docMethod.value.items.filter(item => item.key.value == 'x-functype' );
        if( docFuncType.length == 1 )
          options.func_type = docFuncType[0].value.value;
  
        const docConsumes = docMethod.value.items.filter(item => item.key.value == 'consumes' );
        if( docConsumes.length == 1 && docConsumes[0].value.items.length == 1)
          options.content_type = docConsumes[0].value.items[0].value;

        if( options.content_type == 'multipart/form-data'){
          const parameters = docMethod.value.items.filter(item => item.key.value == 'parameters' );
          parameters.forEach(parameter => {
            parameter.value.items.forEach( item2 => {
              const item_in = item2.items.filter(item => item.key.value == 'in' && item.value.value == 'formData');
              if( item_in.length != 1 )
                return;
                const item_type = item2.items.filter(item => item.key.value == 'type' && item.value.value == 'file');
              if( item_type.length != 1 )
                return;
                const item_name = item2.items.filter(item => item.key.value == 'name');
              if( item_name.length != 1 )
                return;

              options.files.push({ name: item_name[0].value.value } );
            });
          });
        }

        console.log(path, method, handler, JSON.stringify(options));
        if( options.func_type == "express"){
          switch(method){
            case 'get': {
              router.get(path, func_table[folder]);
              break;
            }
            case 'post': {
              router.post(path, func_table[folder]);
              break;
            }
            case 'head': {
              router.head(path, func_table[folder]);
              break;
            }
          }
        }else
        if( options.func_type == 'empty' ){
          switch(method){
            case 'get': {
              router.get(path, (req, res) =>{
                res.json({});
              });
              break;
            }
            case 'post': {
              router.post(path, (req, res) =>{
                res.json({});
              });
              break;
            }
            case 'head': {
              router.head(path, (req, res) =>{
                res.json({});
              });
              break;
            }
          }
        }else{
          const func = require('./' + folder)[handler];
//          func_table[folder] = require('./' + folder)[handler];

          switch(method){
            case 'get': {
              router.get(path, preprocess(options), mainprocess(func));
              break;
            }
            case 'post': {
              router.post(path, preprocess(options), mainprocess(func));
              break;
            }
            case 'head': {
              router.head(path, preprocess(options), mainprocess(func));
              break;
            }
          }
        }
      });
    });
  }catch(error){
    console.log(error);
    return;
  }
});

function preprocess(options){
  return function(req, res, next){
    req.swagger = {
      operation: {
        operationId: options.operationId
      }
    }
    res.func_type = options.func_type;

    if( options.security && req.headers.authorization ){
      switch( options.security ){
        case 'tokenAuth':{
          const decoded = jwt_decode(req.headers.authorization);
          req.requestContext = {
            authorizer : {
              claims : decoded
            }
          };
          break;
        }
        case 'basicAuth': {
          let basic = req.headers.authorization.trim();
          if(basic.toLowerCase().startsWith('basic '))
            basic = basic.slice(6).trim();
  
          const buf = Buffer.from(basic, 'base64');
          const ascii = buf.toString('ascii');
  
          req.requestContext = {
            basicAuth : {
              basic : ascii.split(':')
            }
          };
          break;
        }
        case 'jwtAuth': {
          const decoded = jwt_decode(req.headers.authorization);
          req.requestContext = {
            jwtAuth : {
              claims : decoded
            }
          };
          const claims = {
            claims : decode,
            issuer: decoded.iss,
            id: decoded.sub,
            email: decoded.email
          };
          const buffer = Buffer.from(JSON.stringify(claims));
          req.headers['x-endpoint-api-userinfo'] = buffer.toString('base64');
          break;
        }
        case 'apikeyAuth': {
          req.requestContext = {
            apikeyAuth : {
              apikey : req.headers.authorization
            }
          };
          break;
        }
      }
    }

    if( options.content_type == 'multipart/form-data'){
      let upload;
      if( options.files && options.files.length > 0 ){
        upload = multer({ storage: multer.memoryStorage() }).fields(options.files);
      }else{
        upload = multer().none();
      }
      upload(req, res, function(err){
        if(err)
          throw err;
        next();
      });
    }else{
      next();
    }
  }
}

function mainprocess(func){
  return function(req, res, next){
//    console.log(req);

    const operationId = req.swagger.operation.operationId;
    console.log('[' + req.path + ' calling]');

    try{
        let event;
        if( res.func_type == 'normal' ){
            event = {
                headers: req.headers,
                body: JSON.stringify(req.body),
                path: req.path,
                httpMethod: req.method,
                queryStringParameters: req.query,
                stage: req.baseUrl ? req.baseUrl : '/',
                Host: req.hostname,
                requestContext: ( req.requestContext ) ? req.requestContext : {},
                files: req.files,
            };
        }else
        if( res.func_type == 'alexa' ){
            event = req.body;
        }else
        if( res.func_type == 'lambda' ){
            event = req.body.event;
        }else{
            console.log('can not found operationId: ' + operationId);
            return_error(res, new Error('can not found operationId'));
            return;
        }
        res.returned = false;

  //        console.log(event);

        const context = {
            succeed: (msg) => {
                console.log('succeed called');
                return_response(res, msg);
            },
            fail: (error) => {
                console.log('failed called');
                return_error(res, error);
            },
            req: req,
        };

        const task = func(event, context, (error, response) =>{
            console.log('callback called');
            if( error )
                return_error(res, error);
            else
                return_response(res, response);
        });
        if( task instanceof Promise || (task && typeof task.then === 'function') ){
            task.then(ret =>{
                if( ret ){
                    console.log('promise is called');
                    return_response(res, ret);
                }else{
                    console.log('promise return undefined');
                    return_none(res);
                }
            })
            .catch(err =>{
                console.log('error throwed: ' + err);
                return_error(res, err);
            });
        }else{
            console.log('return called');
  //            return_none(res);
        }
    }catch(err){
        console.log('error throwed: ' + err);
        return_error(res, err);
    }
  }
}

function return_none(res){
    if( res.returned )
        return;
    else
        res.returned = true;

    res.statusCode = 200;
    res.type('application/json');

    if( res.func_type == 'alexa' ){
        res.json({});
    }else if(res.func_type == 'lambda'){
        res.json({ body: null });
    }else{
        res.json({});
    }
}

function return_error(res, err){
    if( res.returned )
        return;
    else
        res.returned = true;

    res.status(500);
    res.json({ errorMessage: err.toString() });
}

function return_response(res, ret){
    if( res.returned )
        return;
    else
        res.returned = true;

    if( ret.statusCode )
        res.status(ret.statusCode);
    for( let key in ret.headers )
        res.set(key, ret.headers[key]);

//    console.log(ret.body);

    if (!res.get('Content-Type'))
        res.type('application/json');

    if( ret.isBase64Encoded ){
        const bin = Buffer.from(ret.body, 'base64')
        res.send(bin);
    }else{
        if( res.func_type == 'alexa'){
            res.json(ret);
        }else if( res.func_type == 'lambda'){
            res.json({ body: ret });
        }else{
            if( ret.body || ret.body == '' )
                res.send(ret.body);
            else
                res.json({});
        }
    }
}

module.exports = router;