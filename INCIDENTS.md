# Incidents log — devops-hometask-01

Журнал багов в доставке домашек и в самих патчах. Цель — не наступать дважды на одни и те же грабли. Каждый инцидент — короткий пост-мортем с симптомом, корнем, фиксом и системным выводом.

Формат записи:

```
## YYYY-MM-DD — короткое имя инцидента

**Симптом:** что увидел студент / AI-агент / e2e-чек.
**Корень:** что на самом деле было сломано в репо/процессе.
**Архив:** ссылка на tag / commit SHA до фикса (если был force-push).
**Фикс:** что сделали.
**Системный вывод:** что добавить в процесс/CI, чтобы не повторилось. Если ещё не добавили — TODO здесь.
```

Записи — в обратном хронологическом порядке (свежие сверху).

---

## 2026-06-30 — hw3.patch на origin был stale, падал у студентов на week2 → week3

**Симптом.** Студент по канону делает `git checkout -b week3 week2`, качает `hw3.patch` из `hw3-handoff` и получает:

```
error: .env.development.compose: already exists in index
error: patch failed: Makefile:1
error: Makefile: patch does not apply
error: app-config/app.json: already exists in index
error: patch failed: back/src/todos/todos.service.ts:1
error: docker-compose.yml: already exists in index
error: patch failed: front/e2e/helpers.ts:5
error: front/e2e/limit.spec.ts: already exists in index
```

Все падающие файлы — это файлы, добавленные/изменённые в hw2.

**Корень.** На `origin/hw3-handoff` лежал старый патч, сгенерированный как `diff(hw-starter, _internal/hw-3-source)` — 424 строки, 12 файлов, включая всю hw2-дельту. По `MAINTAINERS.md` для N≥3 патч обязан быть `diff(hw-{N-1}-source, hw-N-source)` — минимальная дельта только за hwN.

Локально мейнтейнер уже регенерировал правильный патч (коммит `d117452 hw3 handoff: patch from homework-02 to homework-03` — 147 строк, 7 файлов), но **в origin не запушил**. Студенты тянули старую версию.

История регенераций на origin до фикса (5 коммитов, все — попытки исправить, но базой везде был `hw-starter`, а не `_internal/hw-2-source`):

```
9166c69 regen hw3.patch against fixed hw-starter + trailing-slash hardening
1e2c07c regen hw3.patch: fix helpers.ts to use absolute URL
72ed76f fix: regenerate hw3.patch with correct hw-2-source baseline  ← заголовок врёт, по содержимому всё ещё diff vs hw-starter
4a8d413 regen hw3.patch: inherit platform: linux/amd64 TODO hint from hw-2-source
798af5e regen hw3.patch against current hw-starter (post-a195302)
```

**Архив.** `archive/hw3-handoff-pre-fix-2026-06-30` → `9166c69` (запушен на origin). Полная история старых регенераций hw3.patch достижима через этот тег.

**Фикс.** `git push --force-with-lease origin hw3-handoff:hw3-handoff` — origin/hw3-handoff переехал с `9166c69` на `d117452` (правильный delta-патч hw2→hw3).

**Системный вывод.**

1. Smoke-тест из `MAINTAINERS.md` («Smoke-тест после регенерации») формально есть, но не enforced — мейнтейнер может забыть прогнать или забыть запушить результат. Нужен **GitHub Actions workflow на `hw*-handoff`**, который:
   - триггерится на push в `hw*-handoff`,
   - собирает имитацию студенческого `week{N-1}` (последовательно накатывает `hw2.patch`..`hw{N-1}.patch` на `hw-starter`),
   - проверяет `git apply --check hwN.patch` и совпадение результата с `_internal/hw-N-source`,
   - падает → push физически не доезжает до студентов (требует ветку под branch protection с обязательной CI-проверкой).

   Это убирает классы: «забыл прогнать smoke», «забыл запушить локальный фикс», «база патча не та». **TODO — не сделано.**

2. Коммит-сообщения регенераций должны отражать реальную базу: «regen hw3.patch as diff(_internal/hw-2-source, _internal/hw-3-source)» вместо размытого «regen against fixed hw-starter». Чтобы по `git log hw3-handoff` сразу видеть, какая база зашита в данный коммит.

3. Раз в семестр перед стартом потока — прогон полного студенческого флоу для каждой ДЗ (от форка `hw-starter` до `git apply hwN.patch` для всех N последовательно) в чистом окружении. Сейчас делается ad-hoc.
