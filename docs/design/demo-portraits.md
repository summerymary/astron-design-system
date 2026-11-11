# Демонстрационные портреты

Файл проекта: `public/demo/client-portraits.png`. Размер — 1536 × 1024, атлас 3 × 2. Он создан встроенным инструментом image_gen по навыку imagegen для этого прототипа. Это шесть вымышленных взрослых, не фотографии клиентов исходных систем. Портреты используются локально, без запросов к внешнему сервису аватаров. Индекс `photoIndex` выбирает ячейку; при отсутствии индекса показываются инициалы.

Порядок ячеек: Анна, Михаил, Елена / Дмитрий, Мария, Алексей. В исходном наборе шесть клиентов, фото есть у всех шести; это покрывает просьбу показывать фото почти у всех клиентов без создания сотни лишних записей.

Итоговый запрос встроенному инструменту:

> Create ONE photographic contact sheet asset for a fictional fitness-club frontend demo. A perfectly regular edge-to-edge grid of 3 columns by 2 rows, total aspect ratio 3:2. Six equally sized square head-and-shoulder portrait photographs, NO gaps, NO gutters, NO borders, NO text, NO watermarks. Each square has exactly one DIFFERENT fictional adult with face centered around the center of the square, shoulders visible, neutral pale studio background, natural soft lighting, realistic skin, approachable expressions, casual plain clothes. Exact order left to right: top row woman age 28 brown hair; man age 34 short dark hair; woman age 36 shoulder-length light brown hair. Bottom row man age 31 brown hair and light beard; woman age 30 dark hair; man age 38 short light brown hair. All identities invented, no celebrities, no children. Consistent photographic scale across all six squares, face well within square so a circular avatar crop retains the whole face. Clean commercial profile-photo quality. Output only the one 3x2 image atlas.
