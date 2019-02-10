class TreeBuilder {
  static _appendChild(parent, child){
    if (child == null) {
      return;
    }

    const append = this._appendChild.bind(this);

    if (["string", "number", "boolean"].includes(typeof child)) {
      parent.appendChild(document.createTextNode(child));
    } else if (Array.isArray(child)) {
      child.forEach(_child => append(parent, _child));
    } else if (child.constructor.name === "NodeList") {
      Array.from(child).forEach(_child => append(parent, _child));
    } else {
      parent.appendChild(child);
    }
  }

  static _build(tag, attrs, ...children){
    const el = document.createElement(tag);

    for (let k in attrs) {
      const v = attrs[k];
      if (/^on(click|change)$/.test(k)) {
        const eventName = k.substring(2);
        el.addEventListener(eventName, v, false);
      } else if (k === "style") {
        for (let sk in v) {
          const sv = v[sk];
          el.style[sk] = sv;
        }
      } else {
        el.setAttribute(k, v);
      }
    }

    if (children != null) {
      children.forEach(child => {
        this._appendChild(el, child);
      });
    }

    return el;
  }

  static build(fn){
    return fn(TreeBuilder._build.bind(TreeBuilder));
  }

  /**
   * @return NodeList
   */
  static buildRawHtml(html){
    const el = document.createElement("div");
    el.innerHTML = html;
    return el.childNodes;
  }
}
