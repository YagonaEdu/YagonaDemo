/* Shared phrases: formatting helpers, generic actions and states. */

export const format = {
  currencyUzs: { ru: "сум", uz: "so‘m", en: "UZS" },
  noDeadline: { ru: "Без срока", uz: "Muddatsiz", en: "No deadline" },
  overdueMinutes: { ru: "просрочено на {count} мин", uz: "{count} daqiqa kechikdi", en: "{count} min overdue" },
  overdueHours: { ru: "просрочено на {count} ч", uz: "{count} soat kechikdi", en: "{count} h overdue" },
  overdueDays: {
    ru: { one: "просрочено на {count} день", few: "просрочено на {count} дня", many: "просрочено на {count} дней" },
    uz: { one: "{count} kun kechikdi", other: "{count} kun kechikdi" },
    en: { one: "{count} day overdue", other: "{count} days overdue" },
  },
  todayUntil: { ru: "сегодня до {time}", uz: "bugun soat {time} gacha", en: "today by {time}" },
  tomorrowUntil: { ru: "завтра до {time}", uz: "ertaga soat {time} gacha", en: "tomorrow by {time}" },
  inDays: {
    ru: { one: "через {count} день", few: "через {count} дня", many: "через {count} дней" },
    uz: { one: "{count} kundan keyin", other: "{count} kundan keyin" },
    en: { one: "in {count} day", other: "in {count} days" },
  },
  hoursMinutes: { ru: "{hours} ч {minutes} мин", uz: "{hours} soat {minutes} daq", en: "{hours} h {minutes} min" },
  minutes: { ru: "{count} мин", uz: "{count} daq", en: "{count} min" },
  bytes: { ru: "{size} Б", uz: "{size} B", en: "{size} B" },
  kilobytes: { ru: "{size} КБ", uz: "{size} KB", en: "{size} KB" },
  megabytes: { ru: "{size} МБ", uz: "{size} MB", en: "{size} MB" },
};

export const common = {
  networkError: {
    ru: "Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.",
    uz: "Server bilan aloqa yo‘q. Internetni tekshirib, qayta urinib ko‘ring.",
    en: "Cannot reach the server. Check your connection and try again.",
  },
  timeoutError: {
    ru: "Сервер долго не отвечает. Попробуйте ещё раз.",
    uz: "Server uzoq vaqt javob bermayapti. Qayta urinib ko‘ring.",
    en: "The server is taking too long. Please try again.",
  },
  close: { ru: "Закрыть", uz: "Yopish", en: "Close" },
  closeEsc: { ru: "{label} (Esc)", uz: "{label} (Esc)", en: "{label} (Esc)" },
  cancel: { ru: "Отмена", uz: "Bekor qilish", en: "Cancel" },
  save: { ru: "Сохранить", uz: "Saqlash", en: "Save" },
  saving: { ru: "Сохранение…", uz: "Saqlanmoqda…", en: "Saving…" },
  open: { ru: "Открыть", uz: "Ochish", en: "Open" },
  edit: { ru: "Редактировать", uz: "Tahrirlash", en: "Edit" },
  change: { ru: "Изменить", uz: "O‘zgartirish", en: "Change" },
  delete: { ru: "Удалить", uz: "O‘chirish", en: "Delete" },
  duplicate: { ru: "Дублировать", uz: "Nusxa olish", en: "Duplicate" },
  archive: { ru: "Архивировать", uz: "Arxivlash", en: "Archive" },
  publish: { ru: "Опубликовать", uz: "E’lon qilish", en: "Publish" },
  unpublish: { ru: "Снять с публикации", uz: "E’londan olish", en: "Unpublish" },
  retry: { ru: "Повторить", uz: "Qayta urinish", en: "Retry" },
  all: { ru: "Все", uz: "Barchasi", en: "All" },
  allGroups: { ru: "Все группы", uz: "Barcha guruhlar", en: "All groups" },
  allCourses: { ru: "Все курсы", uz: "Barcha kurslar", en: "All courses" },
  search: { ru: "Поиск…", uz: "Qidiruv…", en: "Search…" },
  filters: { ru: "Фильтры", uz: "Filtrlar", en: "Filters" },
  resetFilters: { ru: "Сбросить фильтры", uz: "Filtrlarni tozalash", en: "Reset filters" },
  reset: { ru: "Сбросить", uz: "Tozalash", en: "Reset" },
  actions: { ru: "Действия", uz: "Amallar", en: "Actions" },
  loading: { ru: "Загрузка…", uz: "Yuklanmoqda…", en: "Loading…" },
  emptyDefault: { ru: "Пока пусто", uz: "Hozircha bo‘sh", en: "Nothing here yet" },
  loadFailed: { ru: "Не удалось загрузить данные", uz: "Ma’lumotlarni yuklab bo‘lmadi", en: "Could not load data" },
  noGroup: { ru: "Без группы", uz: "Guruhsiz", en: "No group" },
  dash: { ru: "—", uz: "—", en: "—" },
  yes: { ru: "Да", uz: "Ha", en: "Yes" },
  no: { ru: "Нет", uz: "Yo‘q", en: "No" },
  back: { ru: "Назад", uz: "Orqaga", en: "Back" },
  next: { ru: "Далее", uz: "Keyingi", en: "Next" },
  today: { ru: "Сегодня", uz: "Bugun", en: "Today" },
  logout: { ru: "Выйти", uz: "Chiqish", en: "Log out" },
  language: { ru: "Язык", uz: "Til", en: "Language" },
};

/* Words with numbers. Uzbek nouns after a number stay singular. */
export const plural = {
  students: {
    ru: { one: "{count} ученик", few: "{count} ученика", many: "{count} учеников" },
    uz: { one: "{count} o‘quvchi", other: "{count} o‘quvchi" },
    en: { one: "{count} student", other: "{count} students" },
  },
  groups: {
    ru: { one: "{count} группа", few: "{count} группы", many: "{count} групп" },
    uz: { one: "{count} guruh", other: "{count} guruh" },
    en: { one: "{count} group", other: "{count} groups" },
  },
  lessons: {
    ru: { one: "{count} урок", few: "{count} урока", many: "{count} уроков" },
    uz: { one: "{count} dars", other: "{count} dars" },
    en: { one: "{count} lesson", other: "{count} lessons" },
  },
  works: {
    ru: { one: "{count} работа", few: "{count} работы", many: "{count} работ" },
    uz: { one: "{count} ish", other: "{count} ish" },
    en: { one: "{count} submission", other: "{count} submissions" },
  },
  assignments: {
    ru: { one: "{count} задание", few: "{count} задания", many: "{count} заданий" },
    uz: { one: "{count} topshiriq", other: "{count} topshiriq" },
    en: { one: "{count} assignment", other: "{count} assignments" },
  },
  recipients: {
    ru: { one: "{count} получатель", few: "{count} получателя", many: "{count} получателей" },
    uz: { one: "{count} qabul qiluvchi", other: "{count} qabul qiluvchi" },
    en: { one: "{count} recipient", other: "{count} recipients" },
  },
  words: {
    ru: { one: "{count} слово", few: "{count} слова", many: "{count} слов" },
    uz: { one: "{count} so‘z", other: "{count} so‘z" },
    en: { one: "{count} word", other: "{count} words" },
  },
  questions: {
    ru: { one: "{count} вопрос", few: "{count} вопроса", many: "{count} вопросов" },
    uz: { one: "{count} savol", other: "{count} savol" },
    en: { one: "{count} question", other: "{count} questions" },
  },
  minutes: {
    ru: { one: "{count} минута", few: "{count} минуты", many: "{count} минут" },
    uz: { one: "{count} daqiqa", other: "{count} daqiqa" },
    en: { one: "{count} minute", other: "{count} minutes" },
  },
  centers: {
    ru: { one: "{count} центре", few: "{count} центрах", many: "{count} центрах" },
    uz: { one: "{count} ta markazda", other: "{count} ta markazda" },
    en: { one: "{count} centre", other: "{count} centres" },
  },
};

export const languageNames = {
  uz: { ru: "Узбекский", uz: "O‘zbekcha", en: "Uzbek" },
  ru: { ru: "Русский", uz: "Ruscha", en: "Russian" },
  en: { ru: "Английский", uz: "Inglizcha", en: "English" },
};
