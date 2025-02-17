# \<c-define>: Define web components using pure HTML

> [!WARNING]  
> This library is a work in progress; APIs are subject to change

## Install

```html
<script type="module" src="[url]/c-define.js"></script>
```

## Examples

### Simple Component

```html
<c-define name="c-lorem-ipsum">
    <template>
        <p>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
        </p>

        <style>
            /* just affects elements within component */
            * {
                background-color: red;
            }
        </style>

        <script>
            self.shadowRoot.addEventListener("click", (e) => {
                alert('clicked')
            })
        </script>
    </template>
</c-define>

<c-lorem-ipsum></c-lorem-ipsum>
<c-lorem-ipsum></c-lorem-ipsum>
<p>This text is not affected by the component's style definition.</p>
```

[screenshot]

### Slots

```html
<c-define name="c-slot-example">
    <template>
        <p>
            Some content before the slot.
        </p>
        
        <slot></slot>

        <p>
            Some content after the slot.
        </p>

        <slot name="after">
            <p>
                Default after content.
            </p>
        </slot>
    </template>
</c-define>

<c-slot-example>
    <p slot="after">
        After content.
    </p>

    <p>
        Main content.
    </p>
</c-slot-example>
```

[screenshot]

### Keeping Track of State

```html
<c-define name="c-counter">
    <template>
        <p>
            Counter value: <span id="counter">0</span>

            <button @click="state.value--">-1</button>
            <button @click="state.value++">+1</button>
        </p>

        <script>
            const $counter = self.shadowRoot.getElementById("counter")
            const state = {
                get value() {
                    return parseInt($counter.textContent)
                },
                set value(value) {
                    $counter.textContent = value
                },
            }

            self.shadowRoot.addEventListener("click", ($event) => {
              const onClick = $event.target.getAttribute("@click");
              if (onClick) {
                eval(onClick);
              }
            });
        </script>
    </template>
</c-define>

<!-- use the defined component -->
<c-counter></c-counter>
<c-counter></c-counter>
```

[screenshot]

### Extends

```html
<c-define name="c-counter-but-red" extends="c-counter">
    <template>
        <style>
            * {
                color: red;
            }
        </style>
    </template>
</c-define>

<c-counter></c-counter>
<c-counter-but-red></c-counter-but-red>
```

[screenshot]

This can be used to make base utility components:

- [c-events]
- [c-props]

## Library Philosophy

This library aims to enable web component definitions in HTML with all of the functionality [JS has](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements), with [inheritence](#extends). Any additional functionality should be kept to a minimum: if extending a utility component could provide the functionality then it should likely not be in the core library.

## Conventions

- Include a prefix in each custom element's name (e.g. `c-`), especially for utility base components. This makes it clear which components are defined using this library and which can be extended, and also meets the [custom element name requirements](https://html.spec.whatwg.org/multipage/custom-elements.html#valid-custom-element-name) to start with `[a-z]` and include a hyphen.
