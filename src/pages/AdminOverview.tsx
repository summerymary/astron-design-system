import { Search } from 'lucide-react';

export function AdminOverview() {
  return (
    <div className="reception-focus">
      <section className="reception-ready" aria-label="Работа с клиентом">
        <Search size={32} aria-hidden="true" />
        <h2>Откройте карточку клиента</h2>
        <p>
          Введите или отсканируйте карту в поиске выше.
          <br />
          Также можно найти по ФИО или телефону.
        </p>
      </section>
    </div>
  );
}
