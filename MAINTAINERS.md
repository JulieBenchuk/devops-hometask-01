# Maintainer notes — devops-hometask-01

Этот репозиторий обслуживает несколько домашних заданий, наследующих общую заготовку. Структура веток:

| Ветка | Назначение |
|---|---|
| `hw-starter` | То, с чего студент делает Fork. «Чистая» точка отсчёта для всех ДЗ. |
| `_internal/hw-N-source` | Целевое состояние дерева **после** применения `hwN.patch`. Источник истины для регенерации патча. |
| `hwN-handoff` | Одна-единственная ветка с файлом `hwN.patch` в корне. Студенты качают его `curl`-ом. |
| `main` | Историческая, нечасто обновляется. |

В fork-репо студента:
- `hw-starter` — нетронут, в синке с upstream.
- `weekN` — реализация ДЗ-N. Каждая следующая ответвлена от предыдущей + накат `hwN.patch`.

## Золотое правило

**Любая правка `hw-starter` потенциально ломает все `hwN.patch`.** Если изменённый в `hw-starter` файл также модифицируется патчем — `git apply hw2.patch` упадёт с `patch does not apply` на студенческой машине.

После каждого нетривиального изменения `hw-starter` нужно **регенерировать** `_internal/hw-N-source` и `hwN-handoff` для каждого N.

## Процедура регенерации (для одного N)

```bash
# 1. rebase «применённого» состояния поверх нового hw-starter
git fetch origin
git checkout -b regen-hwN-source origin/_internal/hw-N-source
git rebase origin/hw-starter
#  → разрешить конфликты (обычно Makefile или общие файлы):
#    для файлов, которые патч ЗАМЕНЯЕТ целиком (Makefile), берём theirs;
#    для файлов, которые патч НЕ трогает, конфликта быть не должно — они
#    автоматически берут версию hw-starter.
#  → прогнать ДЗ-N end-to-end, чтобы убедиться, что resolved-дерево рабочее
git push --force-with-lease origin regen-hwN-source:_internal/hw-N-source

# 2. сгенерировать свежий патч и положить на handoff-ветку
git diff origin/hw-starter regen-hwN-source > /tmp/hwN.patch

# sanity-проверка: патч должен чисто применяться на свежий hw-starter
git checkout -b sanity-check origin/hw-starter
git apply --check /tmp/hwN.patch && echo OK

# заменить файл на handoff и запушить
git checkout -B regen-hwN-handoff origin/hwN-handoff
cp /tmp/hwN.patch hwN.patch
git add hwN.patch
git commit -m "regen hwN.patch against current hw-starter"
git push --force-with-lease origin regen-hwN-handoff:hwN-handoff
```

## Smoke-тест после регенерации

Имитация студенческого флоу — чистая проверка цепочки:

```bash
git checkout -b smoke-hwN origin/hw-starter
curl -LO https://raw.githubusercontent.com/it-incubator/devops-hometask-01/hwN-handoff/hwN.patch
git apply --index hwN.patch
# дальше — повторяешь шаги ДЗ-N из методички md-lesson-devops-frontend
```

Если на любом шаге что-то ломается — значит, регенерация прошла некорректно и пользовательский опыт ДЗ сломан.

## Когда регенерировать обязательно

- Любое изменение `Makefile` в `hw-starter`.
- Любое изменение в файлах, которые модифицируются `hwN.patch` (см. `git diff hw-starter _internal/hw-N-source --stat`).
- Добавление новых файлов в `hw-starter` обычно безопасно — патч их не трогает, регенерация не обязательна.

Сомневаешься — гоняй smoke-тест. Это надёжнее анализа.
