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
