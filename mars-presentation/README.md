# Марс — презентація

8 слайдів про Марс (українською) для уроку астрономії. Збирається в один HTML-файл `mars-deck.html`.

Побудовано на бібліотеках із чотирьох репозиторіїв:

- [pmndrs/react-three-fiber](https://github.com/pmndrs/react-three-fiber): 3D-сцена з Марсом, Сонцем, Землею, Фобосом і Деймосом (`src/scene.jsx`).
- [ruucm/shadergradient](https://github.com/ruucm/shadergradient): анімований фон, що змінюється між слайдами (`@shadergradient/react`).
- [paper-design/liquid-logo](https://github.com/paper-design/liquid-logo): «рідкий метал» для слів «МАРС» і «Дякую!» (`@paper-design/shaders-react`, `LiquidMetal`).
- [dashersw/liquid-glass-js](https://github.com/dashersw/liquid-glass-js): ефект рідкого скла на картках, зроблений власним SVG-фільтром за тим самим принципом (`src/template.html`).

Рух побудовано за правилами скіла `animate-ui`: криві ease-out, легке розмиття на вході, 90 мс між елементами, пружинний перехід планети між слайдами, вимкнення руху при «зменшенні руху».

## Збірка

```bash
npm install
node build.mjs   # → mars-deck.html
```

Експорт (кнопка «Експорт» унизу праворуч, працює в переглядачі claude.ai): PDF і PowerPoint з усіма слайдами, PNG поточного слайда, офлайн-HTML з 3D і анімацією. Шрифти вбудовано у файл, тож вони потрапляють в експорт.

Керування: ← → / пробіл, свайп на телефоні, `F` — на весь екран. Посилання на слайд: `#slide-3`.
