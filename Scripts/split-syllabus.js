(function () {
    'use strict';

    // Design fixtures only. No database identifiers or real school/teacher records.
    // District names: https://jharkhand.gov.in/Home/DistrictList
    var districtNames = ['Bokaro', 'Chatra', 'Deoghar', 'Dhanbad', 'Dumka', 'East Singhbhum',
        'Garhwa', 'Giridih', 'Godda', 'Gumla', 'Hazaribagh', 'Jamtara', 'Khunti', 'Koderma',
        'Latehar', 'Lohardaga', 'Pakur', 'Palamu', 'Ramgarh', 'Ranchi', 'Sahibganj',
        'Saraikela Kharsawan', 'Simdega', 'West Singhbhum'];
    var academicMonths = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
    var monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    var currentScope = { month: 10, grade: 'all', subject: 'all', cohort: 'all', district: 'all' };
    var currentRows = [];
    var currentDistricts = [];
    var selectedDistrict = null;
    var soeRequestVersion = 0;
    var soeAbortController = null;
    var integerFormat = new Intl.NumberFormat('en-IN');
    var form = document.getElementById('dashboard-filters');
    if (!form) { return; }

    function byId(id) { return document.getElementById(id); }
    function write(id, value) { byId(id).textContent = value; }
    function number(value) { return integerFormat.format(value); }
    function percent(value) { return value === null ? 'N/A' : value.toFixed(1) + '%'; }
    function rate(value, total) { return total ? 100 * value / total : null; }
    function monthLabel(month) { return monthNames[month - 1] + ' ' + (month <= 3 ? 2027 : 2026); }
    function selectedLabel(id) { var select = byId(id); return select.options[select.selectedIndex].text; }
    function element(tag, className, content) {
        var node = document.createElement(tag);
        if (className) { node.className = className; }
        if (content !== undefined) { node.textContent = content; }
        return node;
    }
    function emptyNode(node) { while (node.firstChild) { node.removeChild(node.firstChild); } }

    // Each fixture row represents a disjoint block/cohort population. Production
    // queries must establish actual distinct teacher/school sets and topic grain.
    function sampleRows(scope) {
        var rows = [];
        var monthIndex = academicMonths.indexOf(scope.month);
        var gradeFactor = scope.grade === 'all' ? 1 : 0.11 + Number(scope.grade) / 180;
        var subjectFactor = scope.subject === 'all' ? 1 : 0.24;
        var subjectSeed = scope.subject === 'all' ? 0 : scope.subject.length;
        districtNames.forEach(function (district, districtIndex) {
            if (scope.district !== 'all' && scope.district !== district) { return; }
            for (var blockIndex = 0; blockIndex < 5; blockIndex++) {
                ['soe', 'other'].forEach(function (cohort, cohortIndex) {
                    if (scope.cohort !== 'all' && scope.cohort !== cohort) { return; }
                    var seed = districtIndex * 11 + blockIndex * 7 + cohortIndex * 19 + subjectSeed;
                    var schools = Math.max(1, Math.round((cohort === 'soe' ? 5 + seed % 8 : 26 + seed % 24) * gradeFactor));
                    var teachers = Math.max(1, Math.round(schools * (5 + seed % 3) * subjectFactor));
                    var monthlyTopics = schools * Math.max(2, Math.round((scope.grade === 'all' ? 60 : 9) * subjectFactor));
                    var target = (cohort === 'soe' ? 83 : 77) + monthIndex % 3 + seed % 5;
                    var noParticipation = districtIndex === 16 || districtIndex === 22 || (seed + monthIndex) % 13 === 0;
                    var completionRatio = noParticipation ? 0 : Math.min(0.97, (cohort === 'soe' ? 0.63 : 0.53) + seed % 23 / 100 + monthIndex / 140);
                    var completed = Math.floor(monthlyTopics * completionRatio);
                    var schoolsStarted = noParticipation ? 0 : Math.min(schools, Math.max(1, Math.ceil(schools * (0.65 + seed % 25 / 100))));
                    var teachersStarted = noParticipation ? 0 : Math.min(teachers, Math.max(1, Math.round(teachers * (0.59 + seed % 30 / 100))));
                    rows.push({ district: district, block: district + ' block ' + String(blockIndex + 1).padStart(2, '0'),
                        cohort: cohort, schools: schools, schoolsStarted: schoolsStarted, teachers: teachers,
                        teachersStarted: teachersStarted, monthlyTopics: monthlyTopics, completed: completed,
                        targetPoints: target * monthlyTopics, pending: noParticipation ? 0 : Math.round(completed * (0.12 + seed % 12 / 100)),
                        revision: noParticipation ? 0 : Math.round(completed * (0.02 + seed % 5 / 100)) });
                });
            }
        });
        return rows;
    }

    function summarize(rows) {
        var totals = { schools: 0, schoolsStarted: 0, teachers: 0, teachersStarted: 0,
            monthlyTopics: 0, completed: 0, targetPoints: 0, pending: 0, revision: 0 };
        rows.forEach(function (row) {
            Object.keys(totals).forEach(function (key) { totals[key] += row[key]; });
        });
        totals.achieved = rate(totals.completed, totals.monthlyTopics);
        totals.target = totals.monthlyTopics ? totals.targetPoints / totals.monthlyTopics : null;
        totals.gap = totals.target === null ? null : totals.target - totals.achieved;
        return totals;
    }

    function grouped(rows, key) {
        var groups = Object.create(null);
        rows.forEach(function (row) { if (!groups[row[key]]) { groups[row[key]] = []; } groups[row[key]].push(row); });
        return Object.keys(groups).map(function (name) {
            var summary = summarize(groups[name]);
            summary.name = name;
            return summary;
        });
    }

    function updateCohort(cohort) {
        var totals = summarize(currentRows.filter(function (row) { return row.cohort === cohort; }));
        write(cohort + '-target', percent(totals.target));
        write(cohort + '-achieved', percent(totals.achieved));
        write(cohort + '-gap', totals.gap === null ? 'N/A' : Math.max(0, totals.gap).toFixed(1) + ' pp');
        if (byId(cohort + '-topics')) {
            write(cohort + '-topics', totals.monthlyTopics ? number(totals.completed) + ' / ' + number(totals.monthlyTopics) + ' sample topics approved' : 'Cohort excluded by selected filter');
        }
        byId(cohort + '-progress').style.width = (totals.achieved || 0) + '%';
        byId(cohort + '-target-marker').style.left = (totals.target || 0) + '%';
        byId(cohort + '-target-marker').hidden = totals.target === null;
    }

    function clearSoeCoverage(message, loading) {
        write('soe-target', '0%'); write('soe-achieved', '0%'); write('soe-gap', '0.0 pp');
        write('soe-goal-label', 'Average monthly target');
        write('soe-data-status', message);
        byId('soe-data-status').hidden = !message;
        byId('soe-progress').style.width = '0%';
        byId('soe-target-marker').hidden = true;
        byId('soe-card').setAttribute('aria-busy', loading ? 'true' : 'false');
    }

    function loadSoeCoverage() {
        var requestVersion = ++soeRequestVersion;
        if (soeAbortController) { soeAbortController.abort(); }
        if (currentScope.cohort === 'other') {
            clearSoeCoverage('SOE schools are excluded by the selected cohort filter.', false);
            return;
        }
        clearSoeCoverage('Loading SOE coverage from the server.', true);
        soeAbortController = new AbortController();
        var controller = soeAbortController;
        var query = new URLSearchParams({ academicYearStart: byId('academic-year').value, month: currentScope.month });
        if (currentScope.grade !== 'all') { query.set('batchId', currentScope.grade); }
        if (currentScope.subject !== 'all') { query.set('subjectName', selectedLabel('subject-filter')); }
        if (currentScope.district !== 'all') { query.set('districtName', currentScope.district); }
        var endpoint = byId('overview').getAttribute('data-soe-coverage-url');
        var timeout = window.setTimeout(function () { controller.abort(); }, 35000);
        fetch(endpoint + '?' + query.toString(), { method: 'GET', credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
            headers: { Accept: 'application/json' } })
            .then(function (response) {
                return response.json().catch(function () {
                    throw new Error('No data found');
                }).then(function (payload) {
                    if (!response.ok || !payload || !payload.success || !payload.data) { throw new Error(payload && payload.message || 'SOE coverage could not be loaded.'); }
                    return payload.data;
                });
            })
            .then(function (data) {
                if (requestVersion !== soeRequestVersion) { return; }
                var hasTarget = typeof data.TargetPercentage === 'number' && Number.isFinite(data.TargetPercentage);
                var hasAchieved = typeof data.AchievedPercentage === 'number' && Number.isFinite(data.AchievedPercentage);
                var target = hasTarget ? data.TargetPercentage : 0;
                var achieved = hasAchieved ? data.AchievedPercentage : 0;
                write('soe-target', target === 0 ? '0%' : percent(target));
                write('soe-achieved', achieved === 0 ? '0%' : percent(achieved));
                write('soe-gap', (hasTarget && hasAchieved ? Math.max(0, target - achieved) : 0).toFixed(1) + ' pp');
                write('soe-goal-label', 'Average monthly target');
                byId('soe-progress').style.width = (achieved || 0) + '%';
                byId('soe-target-marker').style.left = (target || 0) + '%';
                byId('soe-target-marker').hidden = !hasTarget;
                byId('soe-card').setAttribute('aria-busy', 'false');
                write('soe-data-status', hasTarget && hasAchieved ? '' : 'No data found');
                byId('soe-data-status').hidden = hasTarget && hasAchieved;
            })
            .catch(function () {
                if (requestVersion !== soeRequestVersion) { return; }
                clearSoeCoverage('No data found', false);
            })
            .finally(function () { window.clearTimeout(timeout); });
    }

    function updateMetrics() {
        var totals = summarize(currentRows);
        var blocks = grouped(currentRows, 'block');
        var startedDistricts = currentDistricts.filter(function (district) { return district.schoolsStarted > 0; }).length;
        var startedBlocks = blocks.filter(function (block) { return block.schoolsStarted > 0; }).length;
        write('teachers-started', number(totals.teachersStarted));
        write('schools-started', number(totals.schoolsStarted));
        write('teachers-not-started', number(totals.teachers - totals.teachersStarted));
        write('districts-started', number(startedDistricts));
        write('blocks-started', number(startedBlocks));
        write('teachers-started-detail', 'Of ' + number(totals.teachers) + ' eligible sample teachers');
        write('schools-started-detail', 'Of ' + number(totals.schools) + ' eligible sample schools');
        write('districts-started-detail', 'Of ' + currentDistricts.length + ' districts in scope');
        write('blocks-started-detail', 'Of ' + blocks.length + ' sample blocks in scope');
        var requestCount = totals.completed + totals.pending + totals.revision;
        var approvedRate = rate(totals.completed, requestCount);
        var pendingRate = rate(totals.pending, requestCount);
        write('approval-rate', percent(approvedRate));
        write('approved-requests', number(totals.completed));
        write('pending-requests', number(totals.pending));
        write('rejected-requests', number(totals.revision));
        byId('approval-ring').style.background = requestCount ? 'conic-gradient(#259b82 0 ' + approvedRate + '%, #e6b455 ' + approvedRate + '% ' + (approvedRate + pendingRate) + '%, #ba8da0 ' + (approvedRate + pendingRate) + '% 100%)' : '#e3eaed';
        var participationRate = rate(totals.teachersStarted, totals.teachers);
        write('participation-rate', percent(participationRate));
        byId('participation-progress').style.width = (participationRate || 0) + '%';
        write('engagement-started', number(totals.teachersStarted) + ' started');
        write('engagement-remaining', number(totals.teachers - totals.teachersStarted) + ' not started');
        write('approved-topics-total', number(totals.completed) + ' sample topics approved in ' + monthLabel(currentScope.month));
        var behind = currentDistricts.filter(function (district) { return district.gap > 0; }).length;
        write('insight-text', startedDistricts + ' of ' + currentDistricts.length + ' districts have started. ' + behind + ' are below the sample monthly target; ' + number(totals.teachers - totals.teachersStarted) + ' sample teachers have not started.');
        clearSoeCoverage('', false);
        if (currentScope.cohort !== 'other') { updateCohort('soe'); }
        write('soe-goal-label', 'Monthly goal');
        updateCohort('other');
    }

    function sortDistricts() {
        var sort = byId('chart-sort').value;
        return currentDistricts.slice().sort(function (a, b) {
            if (sort === 'achieved') { return b.achieved - a.achieved || a.name.localeCompare(b.name); }
            if (sort === 'gap') { return b.gap - a.gap || a.name.localeCompare(b.name); }
            return a.name.localeCompare(b.name);
        });
    }

    function comparisonRow(summary, clickable) {
        var row = element('div', 'bar-chart-row');
        var label = element(clickable ? 'button' : 'span', clickable ? 'district-name' : 'block-name', summary.name);
        if (clickable) {
            label.type = 'button';
            label.classList.toggle('selected', selectedDistrict === summary.name);
            label.setAttribute('aria-expanded', selectedDistrict === summary.name ? 'true' : 'false');
            label.setAttribute('aria-controls', 'block-panel');
            label.setAttribute('aria-label', summary.name + ': target ' + percent(summary.target) + ', achieved ' + percent(summary.achieved) + '. Show blocks.');
            label.addEventListener('click', function () { showBlocks(summary.name, true); });
        }
        var bars = element('div', 'bar-pair');
        bars.setAttribute('aria-hidden', 'true');
        var targetBar = element('div', 'chart-bar target');
        targetBar.style.width = (summary.target || 0) + '%';
        var achievedBar = element('div', 'chart-bar achieved');
        achievedBar.style.width = (summary.achieved || 0) + '%';
        bars.appendChild(targetBar); bars.appendChild(achievedBar);
        var values = element('div', 'bar-values');
        var targetValue = element('span', 'target-value', percent(summary.target));
        targetValue.setAttribute('aria-label', 'Target ' + percent(summary.target));
        var achievedValue = element('span', 'achieved-value', percent(summary.achieved));
        achievedValue.setAttribute('aria-label', 'Achieved ' + percent(summary.achieved));
        values.appendChild(targetValue); values.appendChild(achievedValue);
        row.appendChild(label); row.appendChild(bars); row.appendChild(values);
        return row;
    }

    function renderDistrictChart() {
        var container = byId('district-chart');
        emptyNode(container);
        sortDistricts().forEach(function (district) { container.appendChild(comparisonRow(district, true)); });
        write('district-chart-count', currentDistricts.length + (currentDistricts.length === 1 ? ' district' : ' districts'));
    }

    function showBlocks(district, scroll) {
        selectedDistrict = district;
        var blocks = grouped(currentRows.filter(function (row) { return row.district === district; }), 'block');
        var container = byId('block-chart');
        emptyNode(container);
        blocks.forEach(function (block) { container.appendChild(comparisonRow(block, false)); });
        write('block-title', district + ' · Block performance');
        write('block-description', blocks.length + ' illustrative blocks · ' + monthLabel(currentScope.month) + ' · Same applied class, subject, and cohort scope.');
        byId('block-panel').hidden = false;
        renderDistrictChart();
        if (scroll) {
            var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            byId('block-panel').scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
        }
        write('dashboard-status', 'Block comparison opened for ' + district + '.');
    }

    function visibleDistricts() {
        var query = byId('district-search').value.trim().toLowerCase();
        return sortDistricts().filter(function (district) { return district.name.toLowerCase().indexOf(query) !== -1; });
    }

    function renderReport() {
        var body = byId('district-table-body');
        emptyNode(body);
        var districts = visibleDistricts();
        districts.forEach(function (district) {
            var row = element('tr');
            var nameCell = element('th');
            nameCell.scope = 'row';
            var districtButton = element('button', 'district-name', district.name);
            districtButton.type = 'button';
            districtButton.setAttribute('aria-controls', 'block-panel');
            districtButton.addEventListener('click', function () { showBlocks(district.name, true); });
            nameCell.appendChild(districtButton); row.appendChild(nameCell);
            row.appendChild(element('td', '', number(district.schoolsStarted)));
            row.appendChild(element('td', '', number(district.teachersStarted)));
            row.appendChild(element('td', '', number(district.completed)));
            row.appendChild(element('td', '', percent(district.target)));
            row.appendChild(element('td', 'achievement-cell', percent(district.achieved)));
            row.appendChild(element('td', 'gap-cell', district.gap === null ? 'N/A' : Math.max(0, district.gap).toFixed(1) + ' pp'));
            var statusCell = element('td');
            var status = district.schoolsStarted === 0 ? 'Not started' : district.gap <= 0 ? 'On target' : 'Below target';
            var statusClass = district.schoolsStarted === 0 ? 'not-started' : district.gap <= 0 ? 'on-track' : 'watch';
            statusCell.appendChild(element('span', 'performance-tag ' + statusClass, status));
            row.appendChild(statusCell); body.appendChild(row);
        });
        if (!districts.length) {
            var emptyRow = element('tr');
            var emptyCell = element('td', 'table-empty', 'No districts match your search. Try another name.');
            emptyCell.colSpan = 8; emptyRow.appendChild(emptyCell); body.appendChild(emptyRow);
        }
        write('report-count', districts.length + ' of ' + currentDistricts.length + ' sample districts shown');
        byId('export-report').disabled = districts.length === 0;
    }

    function svgElement(tag, attributes, content) {
        var node = document.createElementNS('http://www.w3.org/2000/svg', tag);
        Object.keys(attributes).forEach(function (key) { node.setAttribute(key, attributes[key]); });
        if (content !== undefined) { node.textContent = content; }
        return node;
    }

    function renderMonthlyChart() {
        var container = byId('monthly-chart');
        emptyNode(container);
        var months = academicMonths.slice(0, academicMonths.indexOf(currentScope.month) + 1);
        var svg = svgElement('svg', { viewBox: '0 0 1050 220', 'class': 'trend-svg', role: 'img', 'aria-labelledby': 'trend-title trend-description' });
        svg.appendChild(svgElement('title', { id: 'trend-title' }, 'Monthly sample target and achieved percentages'));
        var description = [];
        var chartBottom = 180, chartHeight = 145, start = 45, step = 980 / months.length;
        [0, 25, 50, 75, 100].forEach(function (tick) {
            var y = chartBottom - chartHeight * tick / 100;
            svg.appendChild(svgElement('line', { x1: 38, x2: 1030, y1: y, y2: y, stroke: '#e9eff2', 'stroke-dasharray': tick ? '3 5' : '0' }));
            svg.appendChild(svgElement('text', { x: 28, y: y + 3, 'text-anchor': 'end' }, tick + '%'));
        });
        months.forEach(function (month, index) {
            var scope = Object.assign({}, currentScope, { month: month });
            var summary = summarize(sampleRows(scope));
            var x = start + step * index + step / 2;
            var width = Math.min(22, step / 5);
            var targetHeight = chartHeight * (summary.target || 0) / 100;
            var achievedHeight = chartHeight * (summary.achieved || 0) / 100;
            svg.appendChild(svgElement('rect', { x: x - width - 3, y: chartBottom - targetHeight, width: width, height: targetHeight, rx: 3, fill: '#b4a5df' }));
            svg.appendChild(svgElement('rect', { x: x + 3, y: chartBottom - achievedHeight, width: width, height: achievedHeight, rx: 3, fill: '#269b87' }));
            svg.appendChild(svgElement('text', { x: x, y: chartBottom - Math.max(targetHeight, achievedHeight) - 9, 'text-anchor': 'middle', 'class': 'trend-value' }, percent(summary.achieved)));
            svg.appendChild(svgElement('text', { x: x, y: 204, 'text-anchor': 'middle' }, monthNames[month - 1].slice(0, 3) + ' ' + (month <= 3 ? '27' : '26')));
            description.push(monthLabel(month) + ': target ' + percent(summary.target) + ', achieved ' + percent(summary.achieved));
        });
        svg.appendChild(svgElement('desc', { id: 'trend-description' }, description.join('; ')));
        container.appendChild(svg);
    }

    function applyScope() {
        currentScope = { month: Number(byId('syllabus-month').value), grade: byId('class-filter').value,
            subject: byId('subject-filter').value, cohort: byId('cohort-filter').value, district: byId('district-filter').value };
        currentRows = sampleRows(currentScope);
        currentDistricts = grouped(currentRows, 'district');
        write('period-label', monthLabel(currentScope.month));
        write('scope-label', [monthLabel(currentScope.month), selectedLabel('class-filter'), selectedLabel('subject-filter'), selectedLabel('cohort-filter'), selectedLabel('district-filter')].join(' · '));
        updateMetrics(); renderDistrictChart(); renderReport(); renderMonthlyChart();
        // loadSoeCoverage();
        if (currentScope.district !== 'all') { showBlocks(currentScope.district, false); }
        else if (selectedDistrict && currentDistricts.some(function (district) { return district.name === selectedDistrict; })) { showBlocks(selectedDistrict, false); }
        else { byId('block-panel').hidden = true; }
        write('dashboard-status', 'Sample dashboard updated for ' + monthLabel(currentScope.month) + '. ' + currentDistricts.length + ' districts shown.');
    }

    function csvValue(value) {
        var text = String(value);
        if (/^[=+\-@]/.test(text)) { text = "'" + text; }
        return '"' + text.replace(/"/g, '""') + '"';
    }

    function exportReport() {
        var header = ['Data mode', 'Academic year', 'Syllabus month', 'Class', 'Subject', 'Cohort', 'District',
            'Schools started', 'Teachers started', 'Approved topics', 'Monthly topics', 'Target percentage', 'Achieved percentage', 'Gap percentage points'];
        var rows = [header];
        visibleDistricts().forEach(function (district) {
            rows.push(['ILLUSTRATIVE SAMPLE DATA', '2026-27', monthLabel(currentScope.month),
                currentScope.grade === 'all' ? 'All classes' : 'Class ' + currentScope.grade,
                currentScope.subject, currentScope.cohort, district.name, district.schoolsStarted,
                district.teachersStarted, district.completed, district.monthlyTopics,
                district.target === null ? 'N/A' : district.target.toFixed(1),
                district.achieved === null ? 'N/A' : district.achieved.toFixed(1),
                district.gap === null ? 'N/A' : Math.max(0, district.gap).toFixed(1)]);
        });
        var csv = '\uFEFF' + rows.map(function (row) { return row.map(csvValue).join(','); }).join('\r\n');
        var url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
        var link = element('a');
        link.href = url;
        link.download = 'split-syllabus-sample-2026-27-month-' + currentScope.month + '.csv';
        document.body.appendChild(link); link.click(); link.remove();
        window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        write('dashboard-status', 'Sample district CSV exported using the applied filters and report search.');
    }

    districtNames.forEach(function (district) { var option = element('option', '', district); option.value = district; byId('district-filter').appendChild(option); });
    form.addEventListener('submit', function (event) { event.preventDefault(); applyScope(); });
    form.addEventListener('reset', function () {
        selectedDistrict = null;
        byId('district-search').value = '';
        byId('chart-sort').value = 'name';
        window.setTimeout(applyScope, 0);
    });
    byId('chart-sort').addEventListener('change', function () { renderDistrictChart(); renderReport(); });
    byId('district-search').addEventListener('input', renderReport);
    byId('export-report').addEventListener('click', exportReport);
    byId('close-blocks').addEventListener('click', function () {
        var oldDistrict = selectedDistrict;
        selectedDistrict = null; byId('block-panel').hidden = true; renderDistrictChart();
        var labels = byId('district-chart').querySelectorAll('.district-name');
        Array.prototype.forEach.call(labels, function (label) { if (label.textContent === oldDistrict) { label.focus({ preventScroll: true }); } });
        write('dashboard-status', 'Block comparison closed.');
    });

    function setSidebar(open) {
        byId('dashboard-sidebar').classList.toggle('open', open);
        byId('sidebar-shade').hidden = !open;
        byId('sidebar-open').setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) { byId('sidebar-close').focus(); }
        else { byId('sidebar-open').focus({ preventScroll: true }); }
    }
    byId('sidebar-open').addEventListener('click', function () { setSidebar(true); });
    byId('sidebar-close').addEventListener('click', function () { setSidebar(false); });
    byId('sidebar-shade').addEventListener('click', function () { setSidebar(false); });
    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && byId('dashboard-sidebar').classList.contains('open')) { setSidebar(false); }
        if (event.key === 'Tab' && byId('dashboard-sidebar').classList.contains('open')) {
            var controls = byId('dashboard-sidebar').querySelectorAll('a, button');
            var first = controls[0], last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
    });
    document.querySelectorAll('.sidebar-nav a').forEach(function (link) {
        link.addEventListener('click', function () {
            document.querySelectorAll('.sidebar-nav a').forEach(function (item) { item.classList.remove('active'); item.removeAttribute('aria-current'); });
            link.classList.add('active'); link.setAttribute('aria-current', 'location');
            if (byId('dashboard-sidebar').classList.contains('open')) { setSidebar(false); }
        });
    });
    window.addEventListener('resize', function () {
        if (window.innerWidth > 800 && byId('dashboard-sidebar').classList.contains('open')) {
            byId('dashboard-sidebar').classList.remove('open'); byId('sidebar-shade').hidden = true;
            byId('sidebar-open').setAttribute('aria-expanded', 'false');
        }
    });
    applyScope();
}());
