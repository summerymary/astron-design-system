import { Check, Info } from 'lucide-react';
import { ClubLogo } from './ClubLogo';
import { SectionTitle } from './ui';
import { astronBrand, astronWhiteBrand } from '../data/branding';

export function LogoGuidelines() {
  return (
    <>
      <section className="ds-section">
        <SectionTitle
          title="Логотип клуба"
          subtitle="Основной логотип «Астрона» — чёрный на светлом фоне. Белая версия показывает, как сохраняется контраст на тёмных подложках."
          action={<span className="ds-section-number">01 / ПРИМЕРЫ</span>}
        />
        <div className="logo-demo-grid">
          <div className="logo-demo-card">
            <div className="logo-demo-stage on-brand">
              <ClubLogo brand={astronWhiteBrand} />
            </div>
            <div className="logo-demo-caption">
              <strong>Белый логотип на основном цвете</strong>
              <p>
                Светлая версия для контрастной цветной подложки. Логотип хорошо виден, вокруг
                оставлено свободное место.
              </p>
            </div>
          </div>
          <div className="logo-demo-card">
            <div className="logo-demo-stage on-dark">
              <ClubLogo brand={astronWhiteBrand} surface="dark" />
            </div>
            <div className="logo-demo-caption">
              <strong>Белый логотип на тёмном</strong>
              <p>
                Подходит для тёмной шапки или подложки. На белом фоне нужна отдельная тёмная или
                цветная версия.
              </p>
            </div>
          </div>
        </div>
        <div className="logo-guidelines">
          <div>
            <div className="logo-example-block">
              <ClubLogo brand={astronBrand} />
            </div>
            <h3>Полный логотип</h3>
            <p>
              Используется в боковом меню и шапке. Для него выделяется блок от 120 × 48 px. Широкий
              и высокий логотипы помещаются в него целиком.
            </p>
          </div>
          <div>
            <div className="logo-example-block">
              <ClubLogo brand={astronBrand} variant="compact" />
              <span>Астрон</span>
            </div>
            <h3>Маленький значок</h3>
            <p>
              Для небольших мест нужен отдельный знак от 28 × 28 px. Если такого файла нет,
              показывается первая буква названия. Полный логотип не сжимается до значка.
            </p>
          </div>
          <div>
            <div className="logo-example-block">
              <ClubLogo brand={{ name: 'Другой клуб', initials: 'К', logoTone: 'color' }} />
            </div>
            <h3>Если логотипа пока нет</h3>
            <p>
              Вместо пустого места отображается название клуба. Такой же вариант используется, если
              файл не удалось открыть.
            </p>
          </div>
        </div>
      </section>
      <section className="ds-section">
        <SectionTitle
          title="Правила размещения"
          subtitle="Эти правила одинаковы для всех клубов, независимо от формы их логотипа."
          action={<span className="ds-section-number">02 / ПРАВИЛА</span>}
        />
        <ul className="logo-rules-list">
          <li>
            <strong>Сохранять форму.</strong> Логотип показывается целиком, без растяжения, обрезки,
            поворота и дополнительных эффектов.
          </li>
          <li>
            <strong>Оставлять воздух.</strong> Вокруг полного логотипа нужен свободный от текста и
            значков промежуток: обычно 10–16 px, в небольшой шапке — от 6 px.
          </li>
          <li>
            <strong>Выбирать подходящий фон.</strong> Светлая версия размещается на тёмном фоне,
            тёмная или цветная — на светлом. Фотографии и пёстрые узоры под логотипом не
            используются.
          </li>
          <li>
            <strong>Сохранять фирменные цвета.</strong> Логотип другого клуба не перекрашивается в
            цвет интерфейса автоматически. Подбирается готовая версия, которая хорошо видна на
            выбранном фоне.
          </li>
          <li>
            <strong>Подготавливать хороший файл.</strong> Предпочтителен SVG. PNG или WebP подходят
            с прозрачным фоном и размером хотя бы вдвое больше области показа. Лишние пустые поля в
            файле лучше убрать заранее.
          </li>
          <li>
            <strong>Всегда сохранять название.</strong> Рядом с маленьким значком отображается
            название клуба. Изображение также имеет текстовое название для программ чтения с экрана.
          </li>
        </ul>
        <div className="logo-setup-note">
          <Info size={20} />
          <div>
            <strong>Когда добавляется другой клуб</strong>
            <p>
              Для него указываются название, полный логотип, подходящий фон и, при наличии,
              отдельный маленький знак. Во всех местах используются одинаковые размеры и отступы —
              перестраивать экраны под новый логотип не требуется.
            </p>
          </div>
        </div>
        <div className="logo-setup-note">
          <Check size={20} />
          <div>
            <strong>Перед добавлением стоит проверить</strong>
            <p>
              Логотип читается в боковом меню и на телефоне, не упирается в края, целиком помещается
              в свой блок и остаётся заметным на выбранном фоне.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
