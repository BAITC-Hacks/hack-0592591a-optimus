import { createApp } from "vue";
import "@fontsource/nunito-sans/400.css";
import "@fontsource/nunito-sans/600.css";
import "@fontsource/nunito-sans/700.css";
import "@fontsource/nunito-sans/800.css";
import "@fontsource/nunito-sans/900.css";
import "@fontsource/pt-serif/400.css";
import "./styles/tokens.css";
import "./styles/components.css";
import App from "./App.vue";
import DemoApp from "./demo/DemoApp.vue";

// `/#demo` opens the UI concept on bundled demo data; the default app is the real flow.
createApp(window.location.hash.startsWith("#demo") ? DemoApp : App).mount("#app");
window.addEventListener("hashchange", () => window.location.reload());
