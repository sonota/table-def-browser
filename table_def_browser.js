/**
 * pname: physical name
 */

let _data;

/**
 * @param [String or Array] val
 */
function normalizeText(val){
  if(val == null){
    return "";
  }else if(typeof val === "string"){
    return val;
  }else{
    // array
    return val.join("\n");
  }
}

function getCodeDef(key){
  return normalizeText(codeDef[key]);
}

function expandCodeDef(desc){
  const _desc = normalizeText(desc);

  return _desc.split("\n").map(line =>{
    if( line.match( /^{code:(.+)}$/ ) ){
      return getCodeDef(RegExp.$1);
    }else{
      return line;
    }
  }).join("\n");
}

function getData(){
  if(_data){
    return _data;
  }

  _data = data;
  _data.forEach((table, i)=>{
    table.desc = normalizeText(table.desc);
    table.cols.forEach((col, ci)=>{
      col.desc = expandCodeDef(col.desc);
      col.no = ci + 1;
    });
  });
  return _data;
}

function puts(...args){
  console.log.apply(console, args);
}

function range(from, to){
  return _(_.range(from, to));
}

////////////////////////////////


const SEARCH_MODE = {
  TABLE: "table",
  COLUMN: "col",
  ALL: "all"
};

const DISPLAY_MODE = {
  TABLE: "table",
  ROW: "row"
};


////////////////////////////////
// Utils

function createEl(parent, tagName, attrs, styles, innerHTML){
  const el = document.createElement(tagName);

  if(attrs){
    for(let key of Object.keys(attrs)){
      el.setAttribute(key, attrs[key]);
    }
  }
  if(styles){
    for(let key of Object.keys(styles)){
      el.style[key] = styles[key];
    }
  }
  if(innerHTML){
    el.innerHTML = innerHTML;
  }
  if(parent){
    parent.appendChild(el);
  }
  
  return el;
};

function guard(){
  $("#guard_layer").show();
}
function unguard(){
  $("#guard_layer").hide();
}


////////////////////////////////


class SliceLoop {

  static exec(from, to, step, waitMSec, fn){

    // slice loop object
    const slo = {
      doBreak: false
    };

    setTimeout(()=>{
        SliceLoop.doStep(from, to, step, waitMSec, fn, slo);
      },
      0 // 初回はすぐに実行
    );
    
    return slo;
  }

  static clear(slo){
    if(slo){
      slo.doBreak = true;
    }
  }

  static doStep(from, to, step, waitMSec, fn, slo){
    if(slo.doBreak){ return; }

    const tempTo = Math.min(from + step - 1, to);

    for(let i=from; i<=tempTo; i++){
      fn(i);
    }
    if(tempTo >= to){
      return;
    }

    setTimeout(()=>{
      SliceLoop.doStep(from + step, to, step, waitMSec, fn, slo);
    }, waitMSec);
  }
}


////////////////////////////////


class Table {

  static _text2html(s, queryRegExp){
    if (s == null) {
      return "";
    }

    const lines = s.split("\n");
    return lines.map(line => {
      if (/^https?:\/\/.+/.test(line)) {
        const inner =  this._highlight(line, queryRegExp);
        return `<a href="${line}">${inner}</a>`
      } else {
        return this._highlight(line, queryRegExp);
      }
    }).join("<br />");
  }

  static _em(s){
    return '<span class="matched">' + s + '</span>';
  }

  static _highlight(text, queryRegExp){
    let result = "";

    while(true){
      if( ! text.match(queryRegExp)){
        result += text;
        break;
      }
      if(RegExp.lastMatch.length === 0){
        result += text;
        break;
      }
      result += RegExp.leftContext;
      result += this._em(RegExp.lastMatch);
      text = RegExp.rightContext;
    }

    return result;
  }

  ////////////////////////////////

  constructor(data){
    this.data = data;
  }

  static _makeInnerColsTable(tableData, queryRegExp){
    const cols = tableData.cols;

    const rowEls = [];

    rowEls.push(
      TreeBuilder.build(h =>
        h("tr", {},
          h("th", { "class": "col_no" }, "#"),
          h("th", { "class": "col_name" }, "論理名"),
          h("th", { "class": "col_pname" }, "物理名"),
          h("th", {}, "主キー"),
          h("th", {}, "必須"),
          h("th", {}, "型"),
          h("th", {}, "サイズ"),
          h("th", {}, "備考")
        )
      )
    );

    cols.forEach((col, i)=>{
      rowEls.push(
        TreeBuilder.build(h =>
          h("tr", { "class": "stripe" },
            h("td", { "class": "col_no" }, col.no),
            h("td", { "class": "col_name" },
              TreeBuilder.buildRawHtml(this._highlight(col.name, queryRegExp))
            ),
            h("td", { "class": "col_pname" },
              TreeBuilder.buildRawHtml(this._highlight(col.pname, queryRegExp))
            ),
            h("td", {}, col.pk),
            h("td", {}, col.required ? "*" : ""),
            h("td", {}, col.type),
            h("td", { "class": "col_size" }, col.size),
            h("td", {},
              TreeBuilder.buildRawHtml(
                this._text2html(col.desc, queryRegExp)
              )
            )
          )
        )
      )
    });

    return TreeBuilder.build(h =>
      h("table", { "class": "inner_cols_table" },
        rowEls
      )
    );
  }

  static _getDataByPName(pname){
    return getData().find(it =>{
      return it.pname === pname;
    });
  }

  static _fromPName(pname){
    const tableData = this._getDataByPName(pname);
    return new Table(tableData);
  }


  static fromTR(tr){
    const pname = $(tr).find("input.table_pname").val();
    return this._fromPName(pname);
  }


  makeInsertSql(tablePName){
    const table = this.data;
    let sql = "insert into " + table.pname + " ( ";
    sql += table.cols.map(col =>{
      return col.pname;
    }).join(", ");
    sql += " )\nvalues ( ";
    sql += table.cols.map(col =>{
      let s =  "/*" + col.pname + "*/";
      if(col.required){
        s += "NOT_NULL";
      }else{
        s += "NULL";
      }
      return s;
    }).join(", ");
    sql += " );";
    return sql;
  }

  makeUpdateSql(tablePName){
    const table = this.data;
    let sql = "update " + table.pname
        + "\nset ";
    sql += table.cols.map(col =>{
      if(col.required){
        return col.pname + " = required";
      }else{
        return col.pname + " = null";
      }
    }).join("\n, ");
    sql += "\nwhere 1\n";
    sql += _(table.cols).filter(col =>{
      return col.pk;
    }).map(col =>{
      const s =  "  and " + col.pname + " = ";
      return s;
    }).join(", ");
    sql += "\n;";
    return sql;
  }

  static makeTablesTable(_tables, query){
    const $outer = $(createEl(null, "div"));

    const re = new RegExp(query, "i");

    // 動いているものをキャンセル
    SliceLoop.clear(this.slo);

    var _row, table;

    const templateEl = TreeBuilder.build(h =>
      h("div", {},
        h("table", { "class": "table" },
          h("tr", { "class": "table_row" },
            h("td", { "class": "table_name" },
              h("span", { "class": "table_name" }, "{name}")
            ),
            h("td", { "class": "table_pname" },
              h("span", { "class": "table_pname" }, "{pname}"),
              h("input", { "class": "table_pname", value: "{pname}" }),
              h("br", { "class": "show_insert_sql" }),
              h("input", { "class": "btn_table_window", value: "*", type: "button" }),
            ),
            h("td", { "class": "table_cols", rowspan: 2 })
          ),
          h("tr", {},
            h("td", { "class": "table_desc", colspan: 2 }, "{desc}")
          )
        )
      )
    );

    this.slo = SliceLoop.exec(0, _tables.length-1, 1, 10, (ti)=>{
      var $tableEl = $(templateEl.cloneNode(true));

      table = _tables[ti];
      $tableEl.find("span.table_name").html(this._highlight(table.name, re));
      $tableEl.find("span.table_pname").html(this._highlight(table.pname, re));
      $tableEl.find("input.table_pname").val(table.pname);
      $tableEl.find(".table_desc").html(
        this._text2html(table.desc, re)
      );
      $tableEl.find(".table_cols").append(this._makeInnerColsTable(table, re));

      $outer.append($tableEl);
    });

    return $outer.get(0);
  }

  static makeColsTable(tables, query, searchMode){
    const re = new RegExp(query, "i");

    const tableEl = createEl(null, "table");

    let _tr = createEl(tableEl, "tr");

    // 動いているものをキャンセル
    SliceLoop.clear(this.slo);

    const headerEl = TreeBuilder.build(h =>
      h("tr", {},
        h("th", { "class": "table_name" },
          "テーブル",
          h("br"),
          "論理名"
         ),
        h("th", { "class": "table_pname" },
          "テーブル",
          h("br"),
          "物理名"
        ),
        h("th", { "class": "col_no" }, "#"),
        h("th", { "class": "col_name" }, "論理名"),
        h("th", { "class": "col_pname" }, "物理名"),
        h("th", { "class": "" }, "主キー"),
        h("th", { "class": "" }, "必須"),
        h("th", { "class": "" }, "型"),
        h("th", { "class": "" }, "サイズ"),
        h("th", { "class": "" }, "備考"),
      )
    ).innerHTML;
    createEl(tableEl, "tr", null, null, headerEl);

    var tr, table;
    this.slo = SliceLoop.exec(0, tables.length-1, 5, 10, (ti)=>{
      table = tables[ti];
      table.cols.forEach(col =>{

        let searchTarget = [];

        if(searchMode === SEARCH_MODE.TABLE){
          searchTarget = [table.name, table.pname];
        }else if(searchMode === SEARCH_MODE.COLUMN){
          searchTarget = [col.name, col.pname];
        }else if(searchMode === SEARCH_MODE.ALL){
          searchTarget = [table.name, table.pname, col.name, col.pname, col.desc];
        }

        const matched = searchTarget.some(it => re.test(it));
        if(! matched){
          return;
        }

        _tr = createEl(tableEl, "tr", { "class": "stripe" });

        const el =
          TreeBuilder.build(h =>
            h("div", {},
              h("td", { "class": "table_name" },
                TreeBuilder.buildRawHtml(
                  this._highlight(table.name, re)
                )
              ),
              h("td", { "class": "table_pname" },
                TreeBuilder.buildRawHtml(
                  this._highlight(table.pname, re)
                )
              ),
              h("td", { "class": "col_no" }, col.no),
              h("td", { "class": "col_name" },
                TreeBuilder.buildRawHtml(
                  this._highlight(col.name, re)
                )
              ),
              h("td", {},
                TreeBuilder.buildRawHtml(
                  this._highlight(col.pname, re)
                )
              ),
              h("td", {}, col.pk),
              h("td", {}, col.required ? "*" : ""),
              h("td", {}, col.type),
              h("td", { "class": "col_size" }, col.size),
              h("td", {},
                TreeBuilder.buildRawHtml(
                  this._text2html(col.desc, re)
                )
              )
            )
          );
        const html = el.innerHTML;

        _tr.innerHTML = html;
      });
    });
    return tableEl;
  }
}

// slice loop object
Table.slo = null;


////////////////////////////////


class Popup {

  constructor($el){
    this.$el = $el;
    this.content = null;
  }

  show(){
    const me = this;
    guard();
    me.$el.show();
    me.$el.find(".close").on("click", ()=>{
      me.hide();
    });
  }

  hide(){
    unguard();
    this.$el.hide();
  }

  setContent(el){
    const $content = this.$el.find(".content");
    $content.empty();
    $content.append(el);
  }
}


////////////////////////////////

/**
 * For development
 */
function generateDummyData(){

  function randomStr(){
    const len = Math.random() * 10;
    let s = "";
    range(0, len).each(()=>{
      var n = parseInt(97 + Math.random() * 23, 10);
      s += String.fromCharCode(n);
    });
    return s;
  }

  function withProbability(p, func){
    if(Math.random() < p){
      func();
    }
  }

  const _data = getData();
  range(1, 500).each(tn =>{
    const cols = [];
    range(1, 10).each((cn, ci)=>{
      const col = {
        no: ci + 1,
        name: "col_" + cn + "_" + randomStr(),
        pname: "p_col_" + cn + "_" + randomStr(),
        desc: "desc_" + cn + "_" + randomStr()
      };
      withProbability(0.2, ()=>{
        col.pk = true;
      });
      withProbability(0.2, ()=>{
        col.required = true;
      });
      cols.push(col);
    });

    _data.push({
      name: "table_" + tn + "_" + randomStr(),
      pname: "p_table_" + tn + "_" + randomStr(),
      cols: cols
    });
  });
  
  const manyColTable = {
    name: "カラムの多いテーブル",
    pname: "many_columns",
    desc: "table desc"
  };
  manyColTable.cols = range(1, 200).map((n)=>{
    return {
      no: n,
      name: "lname_" + n,
      pname: "pname_" + n
    };
  });
  _data.push(manyColTable);
}


////////////////////////////////


class TableDefBrowser {

  static _storage(...args){
    const k = args[0], v = args[1];
    if(args.length >= 2){
      localStorage.setItem(k, v);
      return null;
    }else{
      return localStorage.getItem(k);
    }
  }

  ////////////////////////////////

  constructor(){
    const me = this;
    me.$el = $(document.body);
    me.popup = new Popup($("#popup"));
    me.searchFunc = null;
    me.displayMode = null;
    me.query = null;
    me.timers = { search: null };
  }

  ////////////////////////////////

  static _clearResult(){
    $("#result").empty();
  }

  static _showTables(tables, query){
    this._clearResult();
    $("#result").append(Table.makeTablesTable(tables, query));
  }

  static _showRows(tables, query, searchMode){
    this._clearResult();
    $("#result").append(Table.makeColsTable(tables, query, searchMode));
  }

  static _table2text(table){
    const s = [];
    s.push(table.name);
    s.push(table.pname);
    s.push(table.desc);
    table.cols.forEach(col =>{
      s.push(col.name);
      s.push(col.pname);
      s.push(col.desc);
    });
    return s.toString();
  }

  static _showResult(tables, query, searchMode, displayMode){
    if(displayMode === DISPLAY_MODE.TABLE){
      this._showTables(tables, query);
    }else if(displayMode === DISPLAY_MODE.ROW){
      this._showRows(tables, query, searchMode);
    }else{
      throw new Error("unknown display mode (" + displayMode + ")");
    }
  }

  ////////////////////////////////

  static _searchTable(query, displayMode){
    if(query.length < this.queryMinLength ){
      this._clearResult();
      return;
    }
    const re = new RegExp(query, "i");
    const matched = getData().filter(table =>{
      return table.name.match(re) || table.pname.match(re);
    });
    this._storage("query", query);
    this._showResult(matched, query, SEARCH_MODE.TABLE, displayMode);
  }

  static _searchColumn(query, displayMode){
    if(query.length < this.queryMinLength ){
      this._clearResult();
      return;
    }
    const re = new RegExp(query, "i");
    const matched = getData().filter(table =>{
      const found = table.cols.some((col, ci)=>{
        return col.name.match(re) !== null
           || col.pname.match(re) !== null;
      });
      return found;
    });
    this._storage("query", query);
    this._showResult(matched, query, SEARCH_MODE.COLUMN, displayMode);
  }

  static _searchAll(query, displayMode){
    this._storage("search_mode", SEARCH_MODE.ALL);

    if(query.length < this.queryMinLength ){
      this._clearResult();
      return;
    }
    const re = new RegExp(query, "i");
    const matched = getData().filter(table =>{
      return this._table2text(table).match(re);
    });
    this._storage("query", query);
    this._showResult(matched, query, SEARCH_MODE.ALL, displayMode);
  }

  ////////////////////////////////

  changeDisplayMode(mode){
    const me = this;
    const ctor = this.constructor;

    // puts("changeDisplayMode " + mode);
    me.displayMode = mode;
    let $it;
    $("[name=display_mode]").each((i, it)=>{
      $it = $(it);
      if($it.val() === me.displayMode){
        $it.prop("checked", true);
      }else{
        $it.prop("checked", false);
      }
    });
    ctor._storage("display_mode", me.displayMode);
  }

  switchDisplayMode(){
    const $notChecked = $("[name=display_mode]").not(":checked");
    this.displayMode = $notChecked.val();
    this.changeDisplayMode(this.displayMode);
  }

  idleTimeout(timerName, delay, func){
    const me = this;

    if(me.timers[timerName] !== null){
      // puts("cancel timeout");
      clearTimeout(me.timers[timerName]);
      me.timers[timerName] = null;
    }
    me.timers[timerName] = setTimeout(()=>{
      func();
      me.timers[timerName] = null;
    }, delay);
  }

  showTableWindow(table){
    const me = this;
    me.popup.show();

    const $body = $("<div></div>")
        .addClass("name_window_inner")
        .on("click", (ev)=>{
          if(ev.target.nodeName === "INPUT"){
            ev.target.select();
          }
        });

    $("<input />")
        .attr({ type: "button" })
        .val("SQL")
        .on("click", (ev)=>{
          me.popup.setContent($(
            "<textarea>" + table.makeInsertSql()
                + "\n\n" + table.makeUpdateSql()
                + "</textarea>"));
        })
        .appendTo($body);

    $body.append("<hr />");

    function addInput(val){
      const $el = $("<input />").attr({type: "text"}).val(val);
      $body.append($el);
      return $el;
    }

    addInput(table.data.pname)
        .addClass("js_table_pname")
        .css("display", "none");

    addInput(table.data.name);
    addInput(table.data.pname);

    addInput(table.data.pname + " /*" + table.data.name + "*/")
        .addClass("w16rem");

    $body.append("<hr />");

    table.data.cols.forEach(col =>{
      addInput(col.name);
      addInput(col.pname);
      addInput(table.data.name + "." + col.name).addClass("w12rem");
      addInput(table.data.pname + "." + col.pname).addClass("w12rem");
      addInput(col.pname + " /*" + col.name + "*/").addClass("w12rem");

      $body.append("<br />");
    });

    me.popup.setContent($body);

    $("#guard_layer").on("click", (ev)=>{
      if(ev.target.id !== "guard_layer"){
        return;
      }
      me.popup.hide();
    });
  }

  init(options){
    options = options || {};
    const me = this;
    const ctor = this.constructor;

    // for debug
    if(options.debug){
      generateDummyData();
    }

    function onQueryInput(me, sel, searchFunc){
      $(sel).on("input", (ev)=>{
        me.idleTimeout("search", TableDefBrowser.idleTime, ()=>{
          me.searchFunc = searchFunc;
          me.query = ev.target.value;
          me.searchFunc(me.query, me.displayMode);
        });
      });
    }
    onQueryInput(me, "#q_table", ctor._searchTable.bind(ctor));
    onQueryInput(me, "#q_col", ctor._searchColumn.bind(ctor));
    onQueryInput(me, "#q_all", ctor._searchAll.bind(ctor));

    $("#q_table").on("focus", (ev)=>{
      ctor._storage("search_mode", SEARCH_MODE.TABLE);
    });
    $("#q_col").on("focus", (ev)=>{
      ctor._storage("search_mode", SEARCH_MODE.COLUMN);
    });
    $("#q_all").on("focus", (ev)=>{
      ctor._storage("search_mode", SEARCH_MODE.ALL);
    });

    $("#display_mode").on("change", (ev)=>{
      me.displayMode = ev.target.value;
      ctor._storage("display_mode", me.displayMode);
      me.searchFunc(me.query, me.displayMode);
    });

    $("[name=display_mode]").each(it =>{
      if(it.checked){
        me.displayMode = it.value;
      }
    });

    // popup
    $("#result").on("click", (ev)=>{
      if( ! $(ev.target).hasClass("btn_table_window")){
        return;
      }

      const table = Table.fromTR($(ev.target).closest("tr"));

      me.showTableWindow(table);
    });

    me.$el.on("keydown", (ev)=>{
      if(ev.altKey){
        switch(ev.keyCode){
        case 78: // N
          var saerchMode = $("[name=_search_mode]").val();
          let _searchMode;
          switch(searchMode){
          case SEARCH_MODE.TABLE:
            _searchMode = SEARCH_MODE.COLUMN;
            break;
          case SEARCH_MODE.COLUMN:
            _searchMode = SEARCH_MODE.ALL;
            break;
          case SEARCH_MODE.ALL:
            _searchMode = SEARCH_MODE.TABLE;
            break;
          default:
            _searchMode = SEARCH_MODE.ALL;
            break;
          }
          $("#q_" + _searchMode).focus();
          storage("search_mode", _searchMode);
          break;
        case 74: // J
          me.switchDisplayMode();
          if(me.searchFunc){
            me.searchFunc(me.query, me.displayMode);
          }
          break;
        default:
          // do nothing
        }
      }
    });

    // restore cond and display
    (()=>{
      const searchMode = ctor._storage("search_mode");
      if( ! searchMode){
        searchMode = SEARCH_MODE.TABLE;
      }
      $("#q_" + searchMode).focus();

      me.displayMode = ctor._storage("display_mode");
      if( ! me.displayMode){
        me.displayMode = DISPLAY_MODE.TABLE;
      }
      me.changeDisplayMode(me.displayMode);

      me.query = ctor._storage("query");
      $("#q_" + searchMode).val(ctor._storage("query"));

      const funcmap = {
        "table": ctor._searchTable.bind(ctor),
        "col": ctor._searchColumn.bind(ctor),
        "all": ctor._searchAll.bind(ctor)
      };

      this.searchFunc = funcmap[searchMode];
      this.searchFunc(me.query, me.displayMode);
    })();
  }
}

TableDefBrowser.idleTime = 200; // msec
TableDefBrowser.queryMinLength = 1;


////////////////////////////////


document.addEventListener("DOMContentLoaded", ()=>{
  const tdb = new TableDefBrowser();
  tdb.init({
    debug: /\?debug=1$/.test(location.href)
  });
});
