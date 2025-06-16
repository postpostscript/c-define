export type TemplateContextMap = WeakMap<HTMLTemplateElement, TemplateContext>;

/** Cached template computations */
export type TemplateContext = {
  /** Pre-transformed fragment from source template */
  fragment: DocumentFragment;

  /** Functions replacing original template scripts */
  methods: Set<Function>;

  attrs: {
    [name: string]: string[] | undefined;
  };
};

const array = Array.from;

const getAttribute = (el: Element, name: string) => {
  return el.getAttribute(name);
};

const withQuerySelectorAll = <TElement extends Element, TResult>(
  query: string,
  callback: (element: TElement) => TResult,
  root: Pick<Element, "querySelectorAll"> = document
): TResult[] => {
  return array(root.querySelectorAll(query) as NodeListOf<TElement>, callback);
};

const cloneNode = <T extends Node>(node: T): T => {
  return node.cloneNode(true) as T;
};

export default class DynamicElement extends HTMLElement {
  /** Global instance map used to get elements into scripts */
  static instance: { [id: string]: HTMLElement } = {};

  /** Global template templateContext map used to cache template computations */
  static #templates = new WeakMap<HTMLTemplateElement, TemplateContext>();

  static install(tagName: string = "x-is") {
    customElements.define(
      tagName,
      (globalThis.DynamicElement = DynamicElement)
    );
  }

  static compile(template: HTMLTemplateElement): TemplateContext {
    const cached = DynamicElement.#templates.get(template);
    if (cached) {
      return cached;
    }

    let result: TemplateContext = {
      fragment: cloneNode<DocumentFragment>(template.content),
      methods: new Set(),
      attrs: Object.fromEntries(
        array(template.attributes, (attr) => [attr.name, [attr.value]])
      ),
    };

    withQuerySelectorAll(
      "script:not([src])",
      (script: HTMLScriptElement) => {
        const type = getAttribute(script, "type");
        if ([null, "text/javascript", "module"].includes(type)) {
          let code = `{${script.innerHTML}}`;
          if (type === "module") {
            code = `return(async()=>${code})()`;
          }
          result!.methods.add(Function(code));
          script.remove();
        }
      },
      result.fragment
    );

    const extend = getAttribute(template, "extend");

    if (extend) {
      result = DynamicElement.combine([DynamicElement.load(extend), result]);
    }

    DynamicElement.#templates.set(template, result);

    return result;
  }

  static combine(templateContexts: TemplateContext[]): TemplateContext {
    const fragment: TemplateContext["fragment"] = new DocumentFragment();
    const methods = new Set<Function>();
    const attrs: TemplateContext["attrs"] = {};

    templateContexts.forEach((context) => {
      fragment.append(context.fragment);
      for (const method of context.methods) {
        methods.add(method);
      }
      for (const attrName in context.attrs) {
        attrs[attrName] ??= [];
        attrs[attrName].push(...context.attrs[attrName]!);
      }
    });

    return {
      fragment,
      methods,
      attrs,
    };
  }

  static load(src: string): TemplateContext {
    return DynamicElement.combine(
      withQuerySelectorAll(src, DynamicElement.compile)
    );
  }

  /** Instance ID used in `DynamicElement.instance` */
  public id: string = crypto.randomUUID();

  /** Shared copy of the source template context */
  public compile(): TemplateContext {
    return DynamicElement.load(getAttribute(this, "src")!);
  }

  public methods: Function[];

  /** Create DocumentFragment to be appended to the shadowRoot */
  public createFragment({
    fragment: sourceFragment,
    methods,
  }: TemplateContext): DocumentFragment {
    const fragment = cloneNode<DocumentFragment>(sourceFragment);

    this.methods = array(methods);
    // execute init script after all of the DOM loads
    const newScript = document.createElement("script");
    newScript.innerHTML = `DynamicElement.instance["${this.id}"].init()`;
    fragment.append(newScript);

    return fragment;
  }

  /** Execute the script Function equivalents with `this` accessible */
  public init() {
    const instance = this;
    let fn;
    while ((fn = instance.methods.shift())) {
      const result = fn.call(instance);
      if (result instanceof Promise) {
        return result.then(instance.init.bind(instance));
      }
    }
  }

  /** Alias for shadowRoot */
  #shadow = this.attachShadow({
    mode: "open",
  });

  #fragment: DocumentFragment;

  connectedCallback() {
    const instance = this;
    DynamicElement.instance[instance.id] = instance;
    if (instance.#fragment) {
      queueMicrotask(instance.init.bind(instance));
    } else {
      instance.#fragment = instance.createFragment(instance.compile());
      instance.#shadow.append(instance.#fragment);
    }
    instance.methods.push(() => {
      instance.dispatchEvent(new CustomEvent("connected"));
    });
  }
  disconnectedCallback() {
    delete DynamicElement.instance[this.id];
    this.dispatchEvent(new CustomEvent("disconnected"));
  }
}
