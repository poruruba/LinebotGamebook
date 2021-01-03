'use strict';

//var vConsole = new VConsole();

const LIFF_ID = "【LIFF ID】";
const status_url = "【サーバのURL】/linebot-status";

const NUM_OF_PAGE_MEMORIES = 8;

var vue_options = {
    el: "#top",
    data: {
        progress_title: '', // for progress-dialog

        status: null,
        image_show_info: {},
        audio_show_url: null,
        userId: null,
        memory_page_index: 0,
        memory_page_count: 0,
    },
    computed: {
        memory_list_partial: function(){
            if( !this.status )
                return [];
            return this.status.memories.slice((this.memory_page_index - 1) * NUM_OF_PAGE_MEMORIES, this.memory_page_index * NUM_OF_PAGE_MEMORIES - 1);
        }
    },
    methods: {
        do_reload: function(){
            liff.sendMessages([{type: 'text', text: 'リロード'}])
            .then(() =>{
                console.log('success');
                liff.closeWindow();
            })
            .catch(err =>{
                console.error(err);
            });
        },
        do_retire: function(){
            if( !confirm('本当にリタイアしますか？') )
                return;
            liff.sendMessages([{type: 'text', text: 'リタイア'}])
            .then(() =>{
                console.log('success');
                liff.closeWindow();
            })
            .catch(err =>{
                console.error(err);
            });
        },
        do_reset: function(){
            if( !confirm('本当にリセットしますか？') )
                return;
            liff.sendMessages([{type: 'text', text: 'リセット'}])
            .then(() =>{
                console.log('success');
                liff.closeWindow();
            })
            .catch(err =>{
                console.error(err);
            });
        },
        do_close: async function(){
            liff.closeWindow();
        },
        show_image: function(image_info, audio_url){
            this.image_show_info = image_info;
            this.audio_show_url = audio_url;
            this.dialog_open('#show_image_dialog');
        },
        memory_delete: async function(index){
            if( !confirm('本当に削除しますか？') )
                return;

            var index = (this.memory_page_index - 1) * NUM_OF_PAGE_MEMORIES + index;
            var param = {
                id_token: this.id_token,
                cmd: 'delete',
                index: index,
            };
            try{
                await do_post(status_url, param );
                alert('削除しました。');
                this.initialize();
            }catch(err){
                console.error(err);
                alert(err);
            }
        },
        initialize: async function(){
            try{
                await liff.init({
                    liffId: LIFF_ID
                });
                this.id_token = liff.getIDToken();
                var param = {
                    id_token: this.id_token,
                    cmd: 'get'
                };
                var json = await do_post(status_url, param );
                this.memory_page_count = Math.ceil( json.status.memories.length / NUM_OF_PAGE_MEMORIES);
                this.status = json.status;
                console.log(this.status);
            }catch(err){
                console.error(err);
                alert(err);
            }
        }
    },
    created: function(){
    },
    mounted: function(){
        proc_load();

        this.initialize();
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
