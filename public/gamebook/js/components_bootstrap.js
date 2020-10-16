var components_bootstrap = {
  'progress-dialog': {
    props: ['title'],
    template: `
      <div class="modal fade" id="progress">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h4 class="modal-title">{{title}}</h4>
                </div>
                <div class="modal-body">
                    <center><progress max="100" /></center>
                </div>
            </div>
        </div>
      </div>`,
  },
  'modal-dialog': {
    props: ['size'],
    template: `
      <div class="modal fade">
        <div class="modal-dialog" v-bind:class="(size) ? 'modal-' + size : ''">
            <div class="modal-content">
                <slot name="content"></slot>
            </div>
        </div>
      </div>`,
  },
  'collapse-panel': {
    props: ['id', 'collapse', 'title'],
    template: `
      <div class="panel">
        <div class="panel-heading">
          <div class="panel-title"><a data-toggle="collapse" v-bind:href="'#' + id">{{title}}</a></div>
        </div>
        <div class="panel-collapse" v-bind:class="collapse=='true' ? 'collapse' : 'collapse in'" v-bind:id="id">
          <slot name="content"></slot>
        </div>
      </div>`,
  },
  'file-selector':{
    props: ['id', 'drag_image_src', 'accept'],
    template: `
      <div>
        <input type="file" v-bind:id="id" v-bind:accept="accept" v-on:change="file_open" v-on:click="file_click">
        <img class="center-block" v-bind:src="drag_image_src" v-on:drop="file_drop" v-on:dragover="file_drag">
      </div>
    `,
    data: function(){
      return {
        data: null,
        file: null
      }
    },
    methods: {
      file_emit: function(){
        this.$emit('input', { data: this.data, file: this.file });
      },
      file_open: async function(e){
        if( e.target.files[0].type != this.accept ){
            alert(this.accept + 'のファイルではありません。');
            e.target.value = '';
            return;
        }

        this.file = e.target.files[0];
        this.data = await this.file_read(this.file);
        this.file_emit();
      },
      file_drop: async function(e){
        this.file_drag(e);

        if( e.dataTransfer.files[0].type != this.accept ){
            alert(this.accept + 'のファイルではありません。');
            return;
        }

        $(`#${this.id}`)[0].files = e.dataTransfer.files;
        this.file = e.dataTransfer.files[0];
        this.data = await this.file_read(this.file);
        this.file_emit();
      },
      file_click: function(e){
        e.target.value = '';
        this.file = null;
        this.data = null;
        this.file_emit();
      },
      file_drag: function(e){
        e.stopPropagation();
        e.preventDefault();
      },
      file_read: function(file){
        return new Promise((resolve, reject) =>{
            var reader = new FileReader();
            reader.onload = (event) =>{
                resolve(reader.result);
            };
            reader.onerror = (event) =>{
                reject(reader.error);
            }
            reader.readAsDataURL(file);
        })
      },
    }
  },
  'pagenation-bar': {
    props: ['count'],
    template: `
      <paginate
        v-bind:page-count="count"
        v-bind:click-handler="clickCallback"
        v-bind:container-class="'pagination'">
      </paginate>`,
    methods: {
      clickCallback: function(pageNum){
        if( pageNum <= this.count )
          this.$emit('input', pageNum);
      }
    },
    created: function(){
      this.$emit('input', 1);
    }
  }
}
