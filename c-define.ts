const clone = <T extends Node>(node: T): T => {
  return node.cloneNode(true) as T;
};

let _id = 0;
const uniqueId = () => {
  return _id++;
};

export class CDefine extends HTMLElement {
  static cache: Record<string, HTMLTemplateElement> = {};
  static instance: Record<number, HTMLElement> = {};
  static shared: Record<string, Record<any, any>> = {};

  async connectedCallback() {
    let template = clone(this.children[0]);
    const tagName = this.getAttribute("name")?.toLowerCase();
    if (!(template instanceof HTMLTemplateElement && tagName)) {
      throw new Error("missing name or template");
    }
    const extend = this.getAttribute("extend")
      ?.trim()
      .split(/\s*,\s*/g);

    if (extend) {
      await Promise.all(extend.map((el) => customElements.whenDefined(el)));
      template = CDefine.mergeTemplates(
        ...extend
          .map((key) => {
            return clone(CDefine.cache[key]);
          })
          .concat(template)
      );
    }

    CDefine.define(tagName, template as HTMLTemplateElement);
  }

  static define(name: string, template: HTMLTemplateElement) {
    CDefine.cache[name] = template as HTMLTemplateElement;
    CDefine.shared[name] ??= {};

    customElements.define(
      name,
      class extends HTMLElement {
        readonly _id = uniqueId();
        readonly shared = CDefine.shared[name];

        constructor() {
          super();

          CDefine.instance[_id] = this;

          this.attachShadow({
            mode: "open",
          }).append(
            CDefine.normalizeFrag(clone(template.content), ($script) => {
              $script.innerHTML = `{const self = CDefine.instance[${_id}]
${$script.innerHTML}}`;
            })
          );
        }

        disconnectedCallback() {
          delete CDefine.instance[this._id];
        }
      }
    );
  }

  static normalizeFrag(
    frag: DocumentFragment,
    transformScript?: (script: HTMLScriptElement) => any
  ) {
    frag.replaceChildren(
      ...(function* () {
        for (const child of frag.childNodes) {
          if (child instanceof HTMLScriptElement) {
            const script = document.createElement(
              child.tagName
            ) as HTMLScriptElement;
            CDefine.copyAttributes(child, script);
            if (!script.src) {
              script.innerHTML = child.innerHTML;
              transformScript && transformScript(script);
            }
            yield script;
          } else {
            yield child;
          }
        }
      })()
    );
    return frag;
  }

  static mergeTemplates(
    ...templates: HTMLTemplateElement[]
  ): HTMLTemplateElement {
    const base = templates[0];
    for (const template of templates.slice(1)) {
      base.content.append(...template.content.children);
      CDefine.copyAttributes(template, base);
    }
    return base;
  }

  static copyAttributes(copyFrom: HTMLElement, copyTo: HTMLElement) {
    for (const attr of copyFrom.attributes) {
      copyTo.setAttribute(attr.name, attr.value);
      copyTo.setAttributeNode(clone(attr));
    }
  }
}

globalThis.CDefine = CDefine;
customElements.define("c-define", CDefine);
