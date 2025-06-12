/** Cached template computations */
export type TemplateContext = {
  /** Pre-transformed fragment from source template */
  fragment: DocumentFragment;

  /** Functions replacing original template scripts */
  scripts: Function[];
};

export class DynamicElement extends HTMLElement {
  /** Global instance map used to get elements into scripts */
  static instance: { [id: string]: HTMLElement } = {};

  /** Global template #templateContext map used to cache template computations */
  static templates = new WeakMap<HTMLTemplateElement, TemplateContext>();

  static install(tagName: string = "x-is") {
    globalThis.DynamicElement = this;
    customElements.define(tagName, this);
  }

  /** Instance ID used in `DynamicElement.instance` */
  public id: string = crypto.randomUUID().slice(0, 8);
  public internals: ElementInternals = this.attachInternals();

  /** Shared copy of the source template */
  public template: HTMLTemplateElement;

  /** Alias for shadowRoot */
  #shadow = this.attachShadow({
    mode: "open",
  });

  /** Cached template computations */
  get #templateContext(): TemplateContext {
    this.template ??= document.querySelector(
      this.getAttribute("src")!
    ) as HTMLTemplateElement;

    let result = DynamicElement.templates.get(this.template);
    if (!result) {
      // remove "module" and "text/javascript" scripts and create Function equivalents
      // will only happen once per template
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

  /** Execute the script Function equivalents with `this` accessible */
  init() {
    this.#templateContext!.scripts.forEach((fn) => fn.call(this));
  }

  /** Create DocumentFragment to be appended to the shadowRoot */
  #createFragment(): DocumentFragment {
    const fragment = this.#templateContext.fragment.cloneNode(
      true
    ) as DocumentFragment;
    if (this.#templateContext.scripts.length) {
      const newScript = document.createElement("script");
      newScript.innerHTML = `DynamicElement.instance["${this.id}"].init()`;
      // script is executed after all of the DOM loads
      fragment.appendChild(newScript);
    }
    return fragment;
  }

  connectedCallback() {
    DynamicElement.instance[this.id] = this;
    this.#dispatch("connected");
    this.#shadow.appendChild(this.#createFragment());
  }

  disconnectedCallback() {
    delete DynamicElement.instance[this.id];
    this.#dispatch("disconnected");
  }

  connectedMoveCallback() {
    this.#dispatch("connectedMove");
  }

  adoptedCallback() {
    this.#dispatch("adopted");
  }

  attributeChangedCallback(name, old, value) {
    this.#dispatch("attributeChanged", {
      detail: {
        name,
        value,
        old,
      },
    });
  }

  #dispatch<T>(type: string, eventInitDict?: CustomEventInit<T> | undefined) {
    const event = new CustomEvent(type, eventInitDict);
    this.dispatchEvent(event);
  }
}
