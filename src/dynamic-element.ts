type TemplateContext = {
  fragment: DocumentFragment;
  scripts: Function[];
};

export class DynamicElement extends HTMLElement {
  /** Global instance map used to get elements into scripts */
  static instance: { [id: string]: HTMLElement } = {};

  /** Instance ID used in `DynamicElement.instance` */
  public id: string = crypto.randomUUID().slice(0, 8);
  public internals: ElementInternals = this.attachInternals();

  /** Shared copy of the source template */
  public template: HTMLTemplateElement;

  #shadow = this.attachShadow({
    mode: "open",
  });

  static templates = new WeakMap<HTMLTemplateElement, TemplateContext>();

  get templateContext(): TemplateContext {
    this.template ??= document.querySelector(
      this.getAttribute("src")!
    ) as HTMLTemplateElement;

    let result = DynamicElement.templates.get(this.template);
    if (!result) {
      result = {
        fragment: this.template.content.cloneNode(true) as DocumentFragment,
        scripts: [],
      };

      result.fragment
        .querySelectorAll("script:not([src])")
        .forEach((script) => {
          const type = script.getAttribute("type");
          if ([null, "text/javascript", "module"].includes(type)) {
            let code = `{${script.innerHTML.trim()}}`;
            if (type === "module") {
              code = `(async () => ${code})()`;
            }
            result!.scripts.push(Function(code));
            script.remove();
          }
        });

      DynamicElement.templates.set(this.template, result);
    }

    return result;
  }

  init() {
    this.templateContext!.scripts.forEach((fn) => fn.call(this));
  }

  createFragment() {
    const fragment = this.templateContext.fragment.cloneNode(true);
    if (this.templateContext.scripts.length) {
      const newScript = document.createElement("script");
      newScript.innerHTML = `DynamicElement.instance["${this.id}"].init()`;
      fragment.appendChild(newScript);
    }
    return fragment;
  }

  connectedCallback() {
    DynamicElement.instance[this.id] = this;
    this.dispatch("connected");
    this.#shadow.appendChild(this.createFragment());
  }

  disconnectedCallback() {
    delete DynamicElement.instance[this.id];
    this.dispatch("disconnected");
  }

  connectedMoveCallback() {
    this.dispatch("connectedMove");
  }

  adoptedCallback() {
    this.dispatch("adopted");
  }

  attributeChangedCallback(name, old, value) {
    this.dispatch("attributeChanged", {
      detail: {
        name,
        value,
        old,
      },
    });
  }

  dispatch<T>(
    type: string,
    eventInitDict?: CustomEventInit<T> | undefined
  ): CustomEvent<T> {
    const event = new CustomEvent(type, eventInitDict);
    this.dispatchEvent(event);
    return event;
  }

  static define(
    name: string,
    {
      template,
      observedAttributes,
      formAssociated,
    }: {
      template: typeof DynamicElement.prototype.template;
      observedAttributes?: string[];
      formAssociated?: boolean;
    }
  ) {
    customElements.define(
      name,
      class extends DynamicElement {
        static observedAttributes = observedAttributes;
        static formAssociated = formAssociated;
        template = template;
      }
    );
  }

  static install(tagName: string) {
    globalThis.DynamicElement = this;
    customElements.define(tagName, this);
  }
}
