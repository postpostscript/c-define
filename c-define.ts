const clone = <T extends Node>(node: T): T => {
  return node.cloneNode(true) as T;
};

let _id = 0;
const uniqueId = () => {
  return _id++;
};

class CElement extends HTMLElement {
  readonly _id = uniqueId();
  readonly shared: Record<any, any>;
  readonly template: HTMLTemplateElement;

  public onattributechanged: ((e: CustomEvent) => any) | undefined = undefined;
  public ondisconnect: ((e: CustomEvent) => any) | undefined = undefined;
  public onadopted: ((e: CustomEvent) => any) | undefined = undefined;

  attributeChangedCallback(name, old, value) {
    const event = new CustomEvent("attributechanged", {
      detail: {
        name,
        value,
        old,
      },
    });
    if (this.onattributechanged?.(event) !== false) {
      this.dispatchEvent(event);
    }
  }

  disconnectedCallback() {
    this.ondisconnect?.(new CustomEvent("disconnect"));
    delete CDefine.instance[this._id];
  }

  adoptedCallback() {
    this.onadopted?.(new CustomEvent("adopted"));
    CDefine.instance[this._id] = this;
  }
}

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
      template = CDefine.mergeTemplates(
        ...(
          await Promise.all(
            extend.map(async (el) => {
              if (el.startsWith("#")) {
                return document.querySelector<HTMLTemplateElement>(el)!;
              } else {
                await customElements.whenDefined(el);
                return CDefine.cache[el];
              }
            })
          )
        )
          .map(clone)
          .concat(template)
      );
    }

    CDefine.define(tagName, template as HTMLTemplateElement);
  }

  static define(name: string, template: HTMLTemplateElement) {
    CDefine.cache[name] = template as HTMLTemplateElement;
    CDefine.shared[name] ??= {};

    const observedAttributes: string[] = [];
    for (const attr of template.attributes) {
      if (attr.name.startsWith("observe:")) {
        observedAttributes.push(attr.name.slice("observe:".length));
      }
    }

    customElements.define(
      name,
      class extends CElement {
        static observedAttributes = observedAttributes;

        readonly shared = CDefine.shared[name];
        readonly template = template;

        constructor() {
          super();

          CDefine.instance[this._id] = this;
          this.attachShadow({
            mode: "open",
          }).append(
            CDefine.normalizeFrag(clone(this.template.content), ($script) => {
              $script.innerHTML = `{const self = CDefine.instance[${this._id}];${$script.innerHTML}}`;
            })
          );
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
      copyTo.setAttributeNode(clone(attr));
    }
  }
}

globalThis.CDefine = CDefine;
customElements.define("c-define", CDefine);
