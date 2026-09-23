# Task specification

This file is the spec (AGENTS.md §1). Technical scoring is defined by this document, not by the general regulations. The **Criteria scorecard** at the bottom is a living table: update it in the same commit as any change that moves a criterion (AGENTS.md §2a).

## Track and task

Task 1 · ИИ-агент «Анализ организационной структуры и функционала»

## Original text

1. ИИ-агент «Анализ организационной структуры и функционала»
Цель: разработать прототип ИИ-агента, который сравнивает организационные и функциональные документы, выявляет возможную потерю или дублирование функций и формирует объяснимое заключение со ссылками на исходные документы.

2. Проблема
При реорганизации подразделений необходимо вручную сопоставлять организационные структуры, положения и другие приложения к распорядительным документам.
Основные риски: потеря функций, дублирование функционала, пересечение зон ответственности и потенциальный конфликт интересов. Дополнительно может потребоваться проверка соответствия функций внешним требованиям и сравнение структуры с практикой других операторов.

3. Пользователь и сценарий
Основной пользователь – сотрудник подразделения, проводящий анализ организационных изменений.
Сценарий: пользователь загружает комплект документов «до» и «после» реорганизации – агент определяет изменённые подразделения – сравнивает их функции – показывает выявленные отклонения и источники – формирует итоговое заключение.

4. Задача
Разработать прототип ИИ-агента для интеллектуального сопоставления организационных структур и функционала подразделений с возможностью выявления отклонений и формирования объяснимых выводов.

5. Вход → выход
Вход: организационные структуры, положения о структурных подразделениях, должностные инструкции, распорядительные документы и приложения к ним, внутренние нормативные документы. Форматы: Word, PDF, Excel.
Выход: перечень преобразованных/сохранённых подразделений, таблица сопоставления функций, выявленные потери и дублирования, потенциальные конфликты интересов, ссылки на подтверждающие пункты документов и краткие рекомендации.

6. Данные
Организатор предоставляет тестовый набор документов для сравнения. Для проверки соответствия внешним требованиям дополнительно могут быть предоставлены конкретные нормативные документы, стандарты и требования, которыми руководствуются подразделения.
При наличии возможности для бенчмаркинга предоставляются открытые данные об организационных структурах других операторов. Объём и способ доступа к данным указываются организатором отдельно.

7. Must have
1) Определить по приложениям, какие структурные подразделения были реорганизованы, какие сохранились и какие созданы.
2) Сопоставить функционал преобразованных и существующих подразделений и выявить потенциальную потерю функций.
3) Сопоставить функционал подразделений между собой и выявить возможное дублирование функций и конфликт интересов.
4) Для каждого вывода показать подтверждающий источник: документ и соответствующий фрагмент/пункт.
5) Сформировать итоговое аналитическое заключение в понятном для пользователя виде.

8. Опционально
1) Сопоставление задач и функций подразделений с предоставленным законодательством, стандартами и регуляторными требованиями.
2) Сравнение организационных структур преобразованных/созданных департаментов с организационными структурами других операторов.
3) Формирование рекомендаций по перераспределению функций и устранению выявленных пересечений.

9. Ограничения
Выводы ИИ носят рекомендательный характер и требуют проверки ответственным сотрудником. Агент не должен формировать утверждения, не подтверждённые предоставленными документами. Для каждого существенного вывода должна сохраняться прослеживаемость до источника.

10. Артефакты
Работающий прототип, интерфейс для загрузки документов и просмотра результатов, репозиторий с исходным кодом, README с инструкцией запуска и краткое описание архитектуры решения.

11. Простая проверка решения
Команда демонстрирует решение на контрольном комплекте документов, где заранее известны несколько изменений: реорганизация подразделения, потеря функции и дублирование функционала. Проверяется, обнаружил ли агент эти случаи и указал ли корректные источники.

## Scoring criteria and points (from the ТЗ)

| ID | Критерий | Что оцениваем | Баллы |
|---|---|---|---|
| K1 | Соответствие задаче и работоспособность | Оценивается, насколько решение соответствует поставленной задаче и позволяет реализовать основной заявленный сценарий. | 25 |
| K2 | Техническая реализация | Оценивается качество технической реализации решения: выбранный подход, архитектура, взаимодействие компонентов, использование AI/agentic AI и других технологий. Учитывается соответствие фактической реализации заявленной логике проекта. | 25 |
| K3 | README и воспроизводимость | Оценивается, насколько документация позволяет понять устройство проекта, используемые технологии, порядок запуска и основной сценарий работы. Также учитывается возможность воспроизвести и проверить решение на основании материалов репозитория. | 25 |
| K4 | Ценность и применимость решения | Оценивается, насколько решение отвечает обозначенной проблеме. Учитывается практическая применимость представленного подхода. | 15 |
| K5 | Потенциал развития и оригинальность подхода | Оценивается потенциал дальнейшего развития решения, его применения в более широком масштабе, а также наличие обоснованных нестандартных или оригинальных подходов к реализации задачи. | 10 |
| | **Итого** | | **100** |

## Mandatory requirements (Must have, §7 of the ТЗ)

- [ ] M1 Units classified as reorganized / kept / created, from the appendices
- [ ] M2 Functions of transformed vs existing units matched; lost functions detected
- [ ] M3 Functions compared across units; duplication and conflict of interest detected
- [ ] M4 Every finding shows its source: document + fragment/clause
- [ ] M5 Final analytical conclusion, readable by the user
- [ ] Inputs: Word, PDF, Excel
- [ ] UI for uploading documents and viewing results (§10)
- [ ] No claims unsupported by the documents; conclusions marked advisory (§9)

## How reviewers will verify it (from the ТЗ)

Control document set with known changes: one reorganized unit, one lost function, one duplicated function. Checked: did the agent detect each case and cite the correct source (§11). Deliverables: working prototype, upload/results UI, source repo, README with run instructions and a short architecture description (§10).

## Optional / nice to have

- [ ] O1 Check functions against the provided laws, standards and regulations
- [ ] O2 Benchmark the structures of transformed or created departments against other operators
- [ ] O3 Recommendations for redistributing functions and removing overlaps

## Required technologies, data or IP terms stated in the task

No technologies are mandated. Input formats: Word, PDF, Excel. The organizer's test set: pending (volume and access method to be announced separately).

## Our main scenario (one sentence, input to result)

The user uploads the "before" and "after" document sets (docx/pdf/xlsx). The agent classifies units as created, kept or reorganized, maps their functions, and flags losses, duplicates and conflicts of interest, each with its document, clause and quote. It then shows an advisory conclusion.

## Criteria scorecard (living: update with every change that moves a criterion)

Status: ❌ not started · ⚠️ partial · ✅ met and verified in Docker

| ID | Pts | Status | Evidence in repo | Next gap |
|---|---|---|---|---|
| K1 | 25 | ❌ | Template only (caddy + mongo) | Main scenario end-to-end on the control set |
| K2 | 25 | ⚠️ | Compose, Caddy, Mongo 8, healthchecks | API, web, LLM module, agent pipeline with source verification |
| K3 | 25 | ⚠️ | README skeleton, smoke.sh, clean-test.sh | Real run steps, demo set, jury scenario with expected output |
| K4 | 15 | ❌ | — | Traceable findings, readable conclusion, advisory disclaimer |
| K5 | 10 | ❌ | — | One optional item (O3 first) after K1–K4 |
