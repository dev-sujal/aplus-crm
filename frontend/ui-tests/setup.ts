// jsdom lacks a few browser APIs used by the UI primitives.
class RO { observe() {} unobserve() {} disconnect() {} }
;(globalThis as any).ResizeObserver ??= RO
window.HTMLElement.prototype.scrollIntoView ??= () => {}
window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as any
window.confirm = () => true
