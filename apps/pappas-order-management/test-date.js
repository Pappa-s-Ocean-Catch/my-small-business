const parseLocalDate = (dateString) => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};
const formatDateToLocalISO = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const startOfWeek = (dateString) => {
  const date = parseLocalDate(dateString);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return formatDateToLocalISO(date);
};
console.log(startOfWeek('2026-09-08'));
console.log(startOfWeek('2026-09-07'));
console.log(startOfWeek('2026-09-06'));
