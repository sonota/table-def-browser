/**
 * pname: physical name
 */

var _data;

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
  var _desc = normalizeText(desc);

  return _(_desc.split("\n")).map(function(line){
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

  _data = _(data);
  _data.each(function(table, i){
    table.desc = normalizeText(table.desc);
    _(table.cols).each(function(col, ci){
      col.desc = expandCodeDef(col.desc);
      col.no = ci + 1;
    });
  });
  return _data;
}

function puts(){
  console.log.apply(console, arguments);
}

function range(from, to){
  return _(_.range(from, to));
}

////////////////////////////////


var SEARCH_MODE = {
  TABLE: "table",
  COLUMN: "col",
  ALL: "all"
};

var DISPLAY_MODE = {
  TABLE: "table",
  ROW: "row"
};


////////////////////////////////
// Utils

function createEl(parent, tagName, attrs, styles, innerHTML){
  var el = document.createElement(tagName);

  if(attrs){
    for(var key in attrs){
      el.setAttribute(key, attrs[key]);
    }
  }
  if(styles){
    for(var key in styles){
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
    var slo = {
      doBreak: false
    };

    setTimeout(function(){
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

    var tempTo = Math.min(from + step - 1, to);

    for(var i=from; i<=tempTo; i++){
      fn(i);
    }
    if(tempTo >= to){
      return;
    }

    setTimeout(function(){
      SliceLoop.doStep(from + step, to, step, waitMSec, fn, slo);
    }, waitMSec);
  }
}


////////////////////////////////


var Table = (function(){

  // slice loop object
  var slo;

  function text2html(s){
    return s.replace(/\n/g, "<br />");
  }

  function em(s){
    return '<span class="matched">' + s + '</span>';
  }

  function highlight(text, queryRegExp){
    var result = "";

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
      result += em(RegExp.lastMatch);
      text = RegExp.rightContext;
    }

    return result;
  }

  ////////////////////////////////

  function Table(data){
    this.data = data;
  }

  var __ = Table.prototype;

  function makeInnerColsTable(tableData, queryRegExp){
    var cols = tableData.cols;
    var tableEl = createEl(null, "table", { "class": "inner_cols_table" });

    var tr;
    var html = "";
    html += $("#template_inner_cols_table_header").html();
    var _render = _.template($("#template_inner_cols_table_row").html());
    _(cols).each(function(col, i){
      html += _render({
        rowClass: "table_row_" + ((i % 2 === 0) ? "even" : "odd"),
        no: col.no,
        name: highlight(col.name, queryRegExp),
        pname: highlight(col.pname, queryRegExp),
        pk: col.pk,
        required: col.required ? "*" : "",
        type: col.type,
        size: col.size,
        desc: text2html(highlight(col.desc || "", queryRegExp))
      });
    });
    tableEl.innerHTML = html;

    return tableEl;
  };

  function getDataByPName(pname){
    return getData().find(function(it){
      return it.pname === pname;
    });
  };

  function fromPName(pname){
    var tableData = getDataByPName(pname);
    return new Table(tableData);
  };


  Table.fromTR = function(tr){
    var pname = $(tr).find("input.table_pname").val();
    return fromPName(pname);
  };


  __.makeInsertSql = function(tablePName){
    var table = this.data;
    var sql = "insert into " + table.pname + " ( ";
    sql += _(table.cols).map(function(col){
      return col.pname;
    }).join(", ");
    sql += " )\nvalues ( ";
    sql += _(table.cols).map(function(col){
      var s =  "/*" + col.pname + "*/";
      if(col.required){
        s += "NOT_NULL";
      }else{
        s += "NULL";
      }
      return s;
    }).join(", ");
    sql += " );";
    return sql;
  };

  __.makeUpdateSql = function(tablePName){
    var table = this.data;
    var sql = "update " + table.pname
        + "\nset ";
    sql += _(table.cols).map(function(col){
      if(col.required){
        return col.pname + " = required";
      }else{
        return col.pname + " = null";
      }
    }).join("\n, ");
    sql += "\nwhere 1\n";
    sql += _(table.cols).filter(function(col){
      return col.pk;
    }).map(function(col){
      var s =  "  and " + col.pname + " = ";
      return s;
    }).join(", ");
    sql += "\n;";
    return sql;
  };

  Table.makeTablesTable = function(_tables, query){
    var $outer = $(createEl(null, "div"));

    var re = new RegExp(query, "i");

    // 動いているものをキャンセル
    SliceLoop.clear(slo);

    var _row, table;
    var template = $("#table_template").html();
    slo = SliceLoop.exec(0, _tables.length-1, 1, 10, function(ti){
      var $tableEl = $(template);
      table = _tables[ti];
      $tableEl.find("span.table_name").html(highlight(table.name, re));
      $tableEl.find("span.table_pname").html(highlight(table.pname, re));
      $tableEl.find("input.table_pname").val(table.pname);
      $tableEl.find(".table_desc").html(highlight(table.desc || "", re));
      $tableEl.find(".table_cols").append(makeInnerColsTable(table, re));

      $outer.append($tableEl);
    });

    return $outer.get(0);
  };

  Table.makeColsTable = function(tables, query, searchMode){
    var re = new RegExp(query, "i");

    var tableEl = createEl(null, "table");

    var _tr = createEl(tableEl, "tr");

    // 動いているものをキャンセル
    SliceLoop.clear(slo);

    createEl(tableEl, "tr", null, null, $("#template_cols_table_header").html());
    var _render = _.template($("#template_cols_table_row").html());

    var tr, table;
    slo = SliceLoop.exec(0, tables.length-1, 5, 10, function(ti){
      table = tables[ti];
      _(table.cols).each(function(col){

        var searchTarget = [];

        if(searchMode === SEARCH_MODE.TABLE){
          searchTarget = [table.name, table.pname];
        }else if(searchMode === SEARCH_MODE.COLUMN){
          searchTarget = [col.name, col.pname];
        }else if(searchMode === SEARCH_MODE.ALL){
          searchTarget = [table.name, table.pname, col.name, col.pname, col.desc];
        }

        var matched = _(searchTarget).filter(function(it){
          return it && it.match(re);
        });
        if(matched.length === 0){
          return;
        }

        if(ti % 2 === 0){
          _tr = createEl(tableEl, "tr", { "class": "table_row_even" });
        }else{
          _tr = createEl(tableEl, "tr", { "class": "table_row_odd" });
        }

        var html = _render({
          tableName: highlight(table.name, re),
          tablePName: highlight(table.pname, re),
          no: col.no,
          name: highlight(col.name, re),
          pname: highlight(col.pname, re),
          pk: col.pk,
          required: col.required ? "*" : "",
          type: col.type,
          size: col.size,
          desc: text2html(highlight(col.desc || "", re))
        });
        _tr.innerHTML = html;
      });
    });
    return tableEl;
  };

  return Table;
})();


////////////////////////////////


var Popup = (function(){

  function Popup($el){
    this.$el = $el;
    this.content = null;
  }

  var __ = Popup.prototype;

  __.show = function(){
    var me = this;
    guard();
    me.$el.show();
    me.$el.find(".close").on("click", function(){
      me.hide();
    });
  };

  __.hide = function(){
    unguard();
    this.$el.hide();
  };

  __.setContent = function(el){
    var $content = this.$el.find(".content");
    $content.empty();
    $content.append(el);
  };

  return Popup;
})();


////////////////////////////////

/**
 * For development
 */
function generateDummyData(){

  function randomStr(){
    var len = Math.random() * 10;
    var s = "";
    range(0, len).each(function(){
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

  var _data = getData();
  range(1, 500).each(function(tn){
    var cols = [];
    range(1, 10).each(function(cn, ci){
      var col = {
        no: ci + 1,
        name: "col_" + cn + "_" + randomStr(),
        pname: "p_col_" + cn + "_" + randomStr(),
        desc: "desc_" + cn + "_" + randomStr()
      };
      withProbability(0.2, function(){
        col.pk = true;
      });
      withProbability(0.2, function(){
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
  
  var manyColTable = {
    name: "カラムの多いテーブル",
    pname: "many_columns",
    desc: [""]
  };
  manyColTable.cols = range(1, 200).map(function(n){
    return {
      no: n,
      name: "lname_" + n,
      pname: "pname_" + n
    };
  });
  _data.push(manyColTable);
}


////////////////////////////////


var TableDefBrowser = (function(){

  function storage(){
    var k = arguments[0], v = arguments[1];
    if(arguments.length >= 2){
      localStorage.setItem(k, v);
      return null;
    }else{
      return localStorage.getItem(k);
    }
  }

  ////////////////////////////////

  function TableDefBrowser(){
    var me = this;
    me.$el = $(document.body);
    me.popup = new Popup($("#popup"));
    me.searchFunc = null;
    me.displayMode = null;
    me.query = null;
    me.timers = { search: null };
  }

  var __ = TableDefBrowser.prototype;

  TableDefBrowser.idleTime = 200; // msec

  ////////////////////////////////

  function clearResult(){
    $("#result").empty();
  }

  function showTables(tables, query){
    clearResult();
    $("#result").append(Table.makeTablesTable(tables, query));
  }

  function showRows(tables, query, searchMode){
    clearResult();
    $("#result").append(Table.makeColsTable(tables, query, searchMode));
  }

  function table2text(table){
    var s = [];
    s.push(table.name);
    s.push(table.pname);
    _(table.cols).each(function(col){
      s.push(col.name);
      s.push(col.pname);
      s.push(col.desc);
    });
    return s.toString();
  }

  function showResult(tables, query, searchMode, displayMode){
    if(displayMode === DISPLAY_MODE.TABLE){
      showTables(tables, query);
    }else if(displayMode === DISPLAY_MODE.ROW){
      showRows(tables, query, searchMode);
    }else{
      throw new Error("unknown display mode (" + displayMode + ")");
    }
  }

  ////////////////////////////////

  var queryMinLength = 1;
  function searchTable(query, displayMode){
    if(query.length < queryMinLength ){
      clearResult();
      return;
    }
    var re = new RegExp(query, "i");
    var matched = getData().filter(function(table){
      return table.name.match(re) || table.pname.match(re);
    });
    storage("query", query);
    showResult(matched, query, SEARCH_MODE.TABLE, displayMode);
  }

  function searchColumn(query, displayMode){
    if(query.length < queryMinLength ){
      clearResult();
      return;
    }
    var re = new RegExp(query, "i");
    var matched = getData().filter(function(table){
      var found = _(table.cols).filter(function(col, ci){
        return col.name.match(re) !== null
           || col.pname.match(re) !== null;
      });
      return found.length > 0;
    });
    storage("query", query);
    showResult(matched, query, SEARCH_MODE.COLUMN, displayMode);
  }

  function searchAll(query, displayMode){
    storage("search_mode", SEARCH_MODE.ALL);

    if(query.length < queryMinLength ){
      clearResult();
      return;
    }
    var re = new RegExp(query, "i");
    var matched = getData().filter(function(table){
      return table2text(table).match(re);
    });
    storage("query", query);
    showResult(matched, query, SEARCH_MODE.ALL, displayMode);
  }

  ////////////////////////////////

  __.changeDisplayMode = function(mode){
    var me = this;

    // puts("changeDisplayMode " + mode);
    me.displayMode = mode;
    var $it;
    $("[name=display_mode]").each(function(i, it){
      $it = $(it);
      if($it.val() === me.displayMode){
        $it.prop("checked", true);
      }else{
        $it.prop("checked", false);
      }
    });
    storage("display_mode", me.displayMode);
  };

  __.switchDisplayMode = function(){
    var $notChecked = $("[name=display_mode]").not(":checked");
    this.displayMode = $notChecked.val();
    this.changeDisplayMode(this.displayMode);
  };

  __.idleTimeout = function(timerName, delay, func){
    var me = this;

    if(me.timers[timerName] !== null){
      // puts("cancel timeout");
      clearTimeout(me.timers[timerName]);
      me.timers[timerName] = null;
    }
    me.timers[timerName] = setTimeout(function(){
      func();
      me.timers[timerName] = null;
    }, delay);
  };

  __.showTableWindow = function(table){
    var me = this;
    me.popup.show();

    var $body = $("<div></div>")
        .addClass("name_window_inner")
        .on("click", function(ev){
          if(ev.target.nodeName === "INPUT"){
            ev.target.select();
          }
        });

    $("<input />")
        .attr({ type: "button" })
        .val("SQL")
        .on("click", function(ev){
          me.popup.setContent($(
            "<textarea>" + table.makeInsertSql()
                + "\n\n" + table.makeUpdateSql()
                + "</textarea>"));
        })
        .appendTo($body);

    $body.append("<hr />");

    function addInput(val){
      var $el = $("<input />").attr({type: "text"}).val(val);
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

    _(table.data.cols).each(function(col){
      addInput(col.name);
      addInput(col.pname);
      addInput(table.data.name + "." + col.name).addClass("w12rem");
      addInput(table.data.pname + "." + col.pname).addClass("w12rem");
      addInput(col.pname + " /*" + col.name + "*/").addClass("w12rem");

      $body.append("<br />");
    });

    me.popup.setContent($body);

    $("#guard_layer").on("click", function(ev){
      if(ev.target.id !== "guard_layer"){
        return;
      }
      me.popup.hide();
    });
  };

  __.init = function(options){
    options = options || {};
    var me = this;

    // for debug
    if(options.debug){
      generateDummyData();
    }

    function onQueryInput(me, sel, searchFunc){
      $(sel).on("input", function(ev){
        me.idleTimeout("search", TableDefBrowser.idleTime, function(){
          me.searchFunc = searchFunc;
          me.query = ev.target.value;
          me.searchFunc(me.query, me.displayMode);
        });
      });
    }
    onQueryInput(me, "#q_table", searchTable);
    onQueryInput(me, "#q_col", searchColumn);
    onQueryInput(me, "#q_all", searchAll);

    $("#q_table").on("focus", function(ev){
      storage("search_mode", SEARCH_MODE.TABLE);
    });
    $("#q_col").on("focus", function(ev){
      storage("search_mode", SEARCH_MODE.COLUMN);
    });
    $("#q_all").on("focus", function(ev){
      storage("search_mode", SEARCH_MODE.ALL);
    });

    $("#display_mode").on("change", function(ev){
      me.displayMode = ev.target.value;
      storage("display_mode", me.displayMode);
      me.searchFunc(me.query, me.displayMode);
    });

    $("[name=display_mode]").each(function(it){
      if(it.checked){
        me.displayMode = it.value;
      }
    });

    // popup
    $("#result").on("click", function(ev){
      if( ! $(ev.target).hasClass("btn_table_window")){
        return;
      }

      var table = Table.fromTR($(ev.target).closest("tr"));

      me.showTableWindow(table);
    });

    me.$el.on("keydown", function(ev){
      if(ev.altKey){
        switch(ev.keyCode){
        case 78: // N
          var saerchMode = $("[name=_search_mode]").val();
          var _searchMode;
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
    (function(){
      var searchMode = storage("search_mode");
      if( ! searchMode){
        searchMode = SEARCH_MODE.TABLE;
      }
      $("#q_" + searchMode).focus();

      me.displayMode = storage("display_mode");
      if( ! me.displayMode){
        me.displayMode = DISPLAY_MODE.TABLE;
      }
      me.changeDisplayMode(me.displayMode);

      me.query = storage("query");
      $("#q_" + searchMode).val(storage("query"));

      var funcmap = {
        "table": searchTable,
        "col": searchColumn,
        "all": searchAll
      };

      me.searchFunc = funcmap[searchMode];
      me.searchFunc(me.query, me.displayMode);
    })();
  };

  return TableDefBrowser;
})();


////////////////////////////////


$(function(){
  var tdb = new TableDefBrowser();
  tdb.init({
    debug: false
  });
});
