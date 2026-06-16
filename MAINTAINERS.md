# Maintainer notes — devops-hometask-01

Этот репозиторий обслуживает несколько домашних заданий, наследующих общую заготовку. Структура веток:

| Ветка | Назначение |
|---|---|
| `hw-starter` | То, с чего студент делает Fork. «Чистая» точка отсчёта. |
| `_internal/hw-N-source` | Кумулятивное состояние дерева **после** применения всех патчей `hw1.patch ... hwN.patch`. То есть `_internal/hw-N-source` строится поверх `_internal/hw-{N-1}-source`, добавляя только дельту hwN. Источник истины для регенерации патча. |
| `hwN-handoff` | Одна-единственная ветка с файлом `hwN.patch` в корне. Студенты качают его `curl`-ом. |
| `main` | Историческая, нечасто обновляется. |

В fork-репо студента:
- `hw-starter` — нетронут, в синке с upstream.
- `weekN` — реализация ДЗ-N. Каждая следующая ответвлена от предыдущей (`git checkout -b weekN week{N-1}`) + накат `hwN.patch`.

## Топология

```
hw-starter ──► _internal/hw-2-source ──► _internal/hw-3-source ──► _internal/hw-4-source ──► ...
                       │                          │                          │
                       └─► hw2.patch              └─► hw3.patch              └─► hw4.patch
                       (diff vs hw-starter)       (diff vs hw-2-source)      (diff vs hw-3-source)
```

**Важно:** для `N=2` патч — это `diff(hw-starter, hw-2-source)`. Для `N≥3` — `diff(hw-{N-1}-source, hw-N-source)`. Это даёт минимальный патч, содержащий только дельту hwN, который наложится на студенческий `week{N-1}` без конфликтов.

## Золотое правило

**Любая правка `hw-starter`** или любого `_internal/hw-N-source` потенциально ломает hwN+1.patch (и далее). Если изменённый файл также модифицируется патчем — `git apply hwN.patch` упадёт с `patch does not apply` на студенческой машине.

После каждого нетривиального изменения базовой ветки нужно **регенерировать** `_internal/hw-M-source` и `hwM-handoff` для всех M > N (где N — затронутая база).

## Процедура регенерации (для одного N)

```bash
# Выбор базы для патча: hw-starter для N=2, hw-{N-1}-source для N>=3.
BASE_BRANCH="origin/_internal/hw-$((N-1))-source"   # или origin/hw-starter, если N=2

# 1. (если базовая ветка съехала) rebase эталонного состояния hwN поверх неё
git fetch origin
git checkout -b regen-hwN-source origin/_internal/hw-N-source
git rebase $BASE_BRANCH
#  → разрешить конфликты:
#    для файлов, которые патч ЗАМЕНЯЕТ целиком (Makefile), берём theirs;
#    для файлов, которые патч НЕ трогает, конфликта быть не должно — они
#    автоматически берут версию из base.
#  → прогнать ДЗ-N end-to-end, чтобы убедиться, что resolved-дерево рабочее
git push --force-with-lease origin regen-hwN-source:_internal/hw-N-source

# 2. сгенерировать свежий патч (минимальная дельта от предыдущей базы)
git diff $BASE_BRANCH regen-hwN-source > /tmp/hwN.patch

# sanity-проверка: патч чисто применяется на свежую базу,
# результат бит-в-бит совпадает с regen-hwN-source
git checkout -b sanity-check $BASE_BRANCH
git apply --check /tmp/hwN.patch && echo "OK: applies cleanly"
git apply --index /tmp/hwN.patch
[ "$(git diff regen-hwN-source | wc -l)" -eq 0 ] && echo "OK: tree matches" || echo "FAIL: tree differs"

# 3. заменить файл на handoff-ветке и запушить
git checkout -B regen-hwN-handoff origin/hwN-handoff
cp /tmp/hwN.patch hwN.patch
git add hwN.patch
git commit -m "regen hwN.patch against current $BASE_BRANCH"
git push --force-with-lease origin regen-hwN-handoff:hwN-handoff
```

## Smoke-тест после регенерации (полная имитация студенческого флоу)

Чтобы убедиться, что hwN.patch применится на студенческий `week{N-1}` (а не только на чистую базу) — собери цепочку с нуля:

```bash
# для N=2: достаточно проверки на hw-starter (см. процедуру выше)
# для N≥3: имитируй студенческий путь
git checkout -b smoke-hwN origin/hw-starter

# по очереди накатываем hw2.patch, hw3.patch, ..., hw(N-1).patch
for M in 2 3 ... $((N-1)); do
  curl -LO https://raw.githubusercontent.com/it-incubator/devops-hometask-01/hwM-handoff/hwM.patch
  git apply --index hwM.patch
  git commit -m "scaffold hwM"
  rm hwM.patch
done

# теперь накатываем hwN.patch — должен применяться чисто
curl -LO https://raw.githubusercontent.com/it-incubator/devops-hometask-01/hwN-handoff/hwN.patch
git apply --check hwN.patch && echo "OK: cumulative chain works"
git apply --index hwN.patch
# дальше — повторяешь шаги ДЗ-N из методички md-lesson-devops-frontend
```

Если на любом шаге `git apply` ругается — регенерация прошла некорректно или базовая ветка одного из ранних N изменилась без перегенерации последующих.

## Когда регенерировать обязательно

- Любое изменение `Makefile`, `back/src/app.module.ts`, или других «общих» файлов в `hw-starter` или любом `_internal/hw-M-source` → регенерируем все `hwK.patch` для K > M.
- Любое изменение в файлах, которые модифицируются `hwM.patch` (см. `git diff $BASE_BRANCH _internal/hw-M-source --stat`).
- Добавление новых файлов в `hw-starter` обычно безопасно — патчи их не трогают, регенерация не обязательна.

Сомневаешься — гоняй полный smoke-тест по цепочке. Это надёжнее анализа.

## История проблемы (для контекста)

Изначально (до hw4) патчи генерировались как `diff(hw-starter, _internal/hw-N-source)`. Это работало для одиночной проверки (apply на hw-starter), но **не работало** для студентов — у которых на `week{N-1}` уже есть файлы из hw{N-1}.patch (как новые, так и модифицированные). Когда hwN.patch пытался создать те же файлы (`new file mode`) или применить hunks к hw-starter-версии файла — `git apply` падал.

Фикс (применён начиная с hw4): патч генерируется как минимальная дельта от **предыдущей** `_internal/hw-{N-1}-source`. Тогда `git apply hwN.patch` на `week{N-1}` (≈ `hw-{N-1}-source` + студенческие данные) накладывается чисто, потому что начальное состояние совпадает.

Для hw2 этого вопроса нет — там предыдущая база и есть `hw-starter`.
