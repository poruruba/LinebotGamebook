'use strict';

//var vConsole = new VConsole();

const contents_upload_url = "【サーバのURL】/linebot-upload";
const contents_url = "【サーバのURL】/linebot-contents";
const image_base_url = "【サーバのURL】/linebot-image/";
const audio_base_url = "【音声ファイルのURL】";

const NUM_OF_PAGE_IMAGES = 12;

var vue_options = {
    el: "#top",
    data: {
        progress_title: '', // for progress-dialog

        image_base_url : image_base_url,
        scenario_list: [],
        scene_list: [],

        selecting_scenario: "",
        selected_scenario: null,
        scenario: '',
        selecting_scene_index: -1,
        scene: null,
        image_url: null,
        image_src: null,
        image_list: [],
        image_show_name: null,
        image_show_url: null,
        audio: null,
        audio_list: [],

        image_page_index: 0,
        image_page_count: 0,
    },
    computed: {
        image_list_partial: function(){
            return this.image_list.slice((this.image_page_index - 1) * NUM_OF_PAGE_IMAGES, this.image_page_index * NUM_OF_PAGE_IMAGES - 1);
        }
    },
    methods: {
        /* 画像ファイル・音声ファイルのアップロード・削除処理 : ここから */
        image_delete: async function(name){
            if( !confirm("本当に削除しますか？") )
                return;

            var body = {
                cmd: 'delete',
                type: 'image',
                name: name
            };
            try{
                await do_post(contents_url, body);
                await this.image_list_reload();
            }catch(error){
                console.log(error);
                alert(error);
            }
        },
        image_list_reload: async function(){
            var body = {
                cmd: 'list',
                type: 'image'
            };
            try{
                this.image_list = await do_post(contents_url, body);
                this.image_page_count = Math.ceil( this.image_list.length / NUM_OF_PAGE_IMAGES);
            }catch(error){
                console.log(error);
                alert(error);
            }
        },

        image_upload: async function(){
            var param = {
                cmd: 'upload',
                type: 'image',
                upfile: $('#image_file')[0].files[0]
            };
            if( !param.upfile )
                return;

            try{
                await do_post_formdata(contents_upload_url, param);
                alert('アップロードしました。');
                this.dialog_close('#upload_dialog');
                await this.image_list_reload();
            }catch(error){
                console.log(error);
                alert('アップロードに失敗しました。');
            }
        },

        image_open: function(e){
            if (e.target.files.length > 0) {
                if( e.target.files[0].type != 'image/png' ){
                    alert('PNGファイルではありません。');
                    return;
                }

                this.image_open_file(e.target.files[0]);
            }
        },
        image_drop: function(e){
            e.stopPropagation();
            e.preventDefault();

            if( e.dataTransfer.files[0].type != 'image/png' ){
                alert('PNGファイルではありません。');
                return;
            }

            $('#image_file')[0].files = e.dataTransfer.files;
            this.image_open_file(e.dataTransfer.files[0]);
        },
        image_click: function(e){
            this.image_src = null;

            e.target.value = '';
        },
        image_open_file: function(file){
            var reader = new FileReader();
            reader.onload = (theFile) =>{
                this.image_src = reader.result;
            };
            reader.readAsDataURL(file);
        },
        image_show: function(name){
            this.image_show_name = name;
            this.image_show_url = image_base_url + name;
            this.dialog_open('#show_image_dialog');
        },
        file_drag: function(e){
            e.stopPropagation();
            e.preventDefault();
        },

        audio_delete: async function(name){
            if( !confirm("本当に削除しますか？") )
                return;

            var body = {
                cmd: 'delete',
                type: 'audio',
                name: name
            };
            try{
                await do_post(contents_url, body);
                await this.audio_list_reload();
            }catch(error){
                console.log(error);
                alert(error);
            }
        },
        audio_list_reload: async function(){
            var body = {
                cmd: 'list',
                type: 'audio'
            };
            try{
                this.audio_list = await do_post(contents_url, body);
            }catch(error){
                console.log(error);
                alert(error);
            }
        },        
        audio_upload: async function(){
            var param = {
                cmd: 'upload',
                type: 'audio',
                upfile: $('#audio_file')[0].files[0]
            };
            if( !param.upfile )
                return;

            try{
                await do_post_formdata(contents_upload_url, param);
                alert('アップロードしました。');
                this.dialog_close('#upload_audio_dialog');
                await this.audio_list_reload();
            }catch(error){
                console.log(error);
                alert('アップロードに失敗しました。');
            }
        },
        audio_open: function(e){
            if (e.target.files.length > 0) {
                if( e.target.files[0].type != 'audio/x-m4a' ){
                    alert('M4Aファイルではありません。');
                    return;
                }

                this.audio_open_file(e.target.files[0]);
            }
        },
        audio_open_file: function(file){
            var reader = new FileReader();
            reader.onload = (theFile) =>{
                this.audio = new Audio(reader.result);
            };
            reader.readAsDataURL(file);
        },
        audio_play: function(name){
            if( !name ){
                this.audio.play();
            }else{
                var audio = new Audio(audio_base_url + name + '.m4a');
                audio.play();
            }
        },
        audio_drop: function(e){
            e.stopPropagation();
            e.preventDefault();

            if( e.dataTransfer.files[0].type != 'audio/x-m4a' ){
                alert('M4Aファイルではありません。');
                return;
            }

            $('#audio_file')[0].files = e.dataTransfer.files;
            this.audio_open_file(e.dataTransfer.files[0]);
        },
        audio_click: function(e){
            this.audio = null;

            e.target.value = '';
        },
        /* 画像ファイル・音声ファイルのアップロード・削除処理 : ここまで */

        scenario_list_reload: async function(){
            var param = {
                type: "scenario",
                cmd: 'list'
            };
            this.scenario_list = await do_post(contents_url, param);
            this.selecting_scenario = '';
        },
        scenario_load: async function(load_scenario, scene){
            if( !load_scenario )
                return;
            if( this.selected_scenario && this.selected_scenario != load_scenario && !confirm('本当に編集中のシナリオを破棄してリロードしますか？') )
                return;

            var param = {
                cmd: 'download',
                type: 'scenario',
                fname: load_scenario
            };
            var scenario = await do_post(contents_url, param );
            scenario.scene.forEach(item => item = this.scene_normalize(item));
            this.selected_scenario = load_scenario;
            this.scenario = scenario;
            this.scene_list = this.scenario.scene;
            if( scene ){
                this.selecting_scene_index = this.scene_list.findIndex(item => item.id == scene);
                this.scene_change();
            }else{
                this.selecting_scene_index = -1;
                this.scene = null;
            }
        },
        scenario_reload: async function(scene){
            this.scenario_reload(this.selected_scenario, scene);
        },
        scenario_delete: async function(){
            if( !this.selecting_scenario )
                return;
            if( !confirm('本当に削除しますか？') )
                return;

            var body = {
                type: 'scenario',
                cmd: 'delete',
                fname: this.selecting_scenario,
            };
            try{
                await do_post(contents_url, body);
                this.scenario_list_reload();
            }catch(error){
                console.error(error);
                alert(error);
            }
        },
        scenario_save: async function(){
            var body = {
                type: 'scenario',
                cmd: 'update',
                fname: this.selected_scenario,
                scenario: this.scenario
            }
            try{
                await do_post(contents_url, body);
                alert('保存しました。');
            }catch(error){
                console.error(error);
                alert(error);
            }
        },
        scenario_create: async function(){
            var fname = window.prompt("シナリオファイル名を入力してください。");
            if( !fname )
                return;

            if( !fname.endsWith(".json") )
                fname += '.json';
            var scenario = {
                scene: [{
                  id: "0",
                  text: "サンプルテキスト"  
                }]
            };
            var body = {
                type: 'scenario',
                cmd: 'create',
                fname: fname,
                scenario: scenario
            };
            try{
                await do_post(contents_url, body);
                this.scenario_list_reload();
            }catch(error){
                console.error(error);
                alert(error);
            }
        },
        scenario_move: function(id, scene){
            this.scenario_load(id + '.json', scene ? scene : "0");
        },

        scene_normalize: function(scene){
            if(!scene.image){
                scene.image = {
                    composite: []
                };
            }else{
                if( !scene.image.composite ){
                    scene.image.composite = [];
                }else{
                    scene.image.composite.forEach(item2 =>{
                        if( !item2.position ) item2.position = 6;
                        if( !item2.have ) item2.have = [];
                        if( !item2.nothave ) item2.nothave = [];
                    });
                }
            }

            if( !scene.selection ){
                scene.selection = [];
            }else{
                scene.selection.forEach(select =>{
                    if( !select.type ) select.type = "scene";
                    if( !select.have ) select.have = [];
                    if( !select.nothave ) select.nothave = [];
                });
            }
            if( !scene.audio ){
                scene.audio = {
                    have: [],
                    nothave: []
                };
            }else{
                if( !scene.audio.have ) scene.audio.have = [];
                if( !scene.audio.nothave ) scene.audio.nothave = [];
            }
            if( !scene.acquire ) scene.acquire = [];
            if( !scene.lost ) scene.lost = [];

            return scene;
        },

        scene_add: function(){
            var id = window.prompt("idを入力してください。");
            if( !id )
                return;
            var scene = this.scene_normalize({ id: id });
            this.scenario.scene.push(scene);
            this.selecting_scene_index = this.scenario.scene.length - 1;
            this.scene_change();
        },
        scene_remove: function(){
            if( this.selecting_scene_index < 0 )
                return;
            if( !confirm('本当に削除しますか？') )
                return;

            this.scenario.scene.splice(this.selecting_scene_index, 1);
            this.selecting_scene_index = -1;
            this.scene_change();
        },
        scene_move: function(id){
            var index = this.scenario.scene.findIndex(item => item.id == id);
            if( index < 0 )
                return;
            this.selecting_scene_index = index;
            this.scene_change();
        },
        scene_change: async function(){
            this.scene = this.scenario.scene[this.selecting_scene_index];
            this.update_image_url();
        },

        selection_add: function(){
            var id = window.prompt("idを入力してください。");
            if( !id )
                return;

            this.scene.selection.push({
                id: id,
                type: 'scene',
                have: [],
                nothave: []
            });
        },
        selection_remove: function(index){
            this.scene.selection.splice(index, 1);
        },
        select_type_change: function(index){
            if( this.scene.selection[index].type == 'scenario' )
                this.scene.selection[index].scene = '0';
            else
                delete this.scene.selection[index].scene;
        },
        composite_add: function(){
            this.scene.image.composite.push({
                name: '',
                position: 6,
                have: [],
                nothave: []
            });
        },
        composite_remove: function(index){
            this.scene.image.composite.splice(index, 1);
        },
        item_add: function(list){
            var name = window.prompt("nameを入力してください。");
            if( !name )
                return list;

            list.push(name);
            return list;
        },
        item_remove: function(list, index){
            list.splice(index, 1);
            return list;
        },
        
        update_image_url: function(){
            if(!this.scene || !this.scene.image.background)
                this.image_url = "";
            var url = image_base_url + this.scene.image.background;
            for( var i = 0 ; i < this.scene.image.composite.length ; i++ ){
                url += '-' + this.scene.image.composite[i].name + '_' + this.scene.image.composite[i].position;
            }
            this.image_url = url;
        },
    },
    created: function(){
    },
    mounted: function(){
        proc_load();

        this.scenario_list_reload();
        this.image_list_reload();
        this.audio_list_reload();
    }
};
vue_add_methods(vue_options, methods_bootstrap);
Vue.component('paginate', VuejsPaginate);
vue_add_components(vue_options, components_bootstrap);
var vue = new Vue( vue_options );

function do_post(url, body) {
    const headers = new Headers({ "Content-Type": "application/json; charset=utf-8" });
  
    return fetch(new URL(url).toString(), {
        method: 'POST',
        body: JSON.stringify(body),
        headers: headers
      })
      .then((response) => {
        if (!response.ok)
          throw 'status is not 200';
        return response.json();
      });
  }

  function do_post_formdata(url, params) {
    var body = Object.entries(params).reduce((l, [k, v]) => {
      l.append(k, v);
      return l;
    }, new FormData());

    return fetch(new URL(url).toString(), {
        method: 'POST',
        body: body,
      })
      .then((response) => {
        if (!response.ok)
          throw 'status is not 200';
        return response.json();
      });
}
