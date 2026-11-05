// 双击Shift全局搜索（系统插件）
// 依赖系统插件API window.weekReport（src/plugins/api.js 暴露）：
//   weekReport.reports.search()   全量周报（含sections，内存缓存）
//   weekReport.ui.selectReport()  选中并打开周报
//   weekReport.ui.toast()         轻提示
(function() {
    const DEBOUNCE_MS = 180;   // 输入防抖
    const PAGE_SIZE = 20;      // 搜索结果滚动分页大小

    // 创建样式
    const style = document.createElement('style');
    style.textContent = `
        .double-shift-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: var(--el-overlay-color-light, rgba(0, 0, 0, 0.7));
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.3s, visibility 0.3s;
        }

        .double-shift-modal.active {
            opacity: 1;
            visibility: visible;
        }

        .double-shift-search-box {
            width: 700px;
            max-width: 90vw;
            background-color: var(--el-bg-color-overlay, #fff);
            color: var(--el-text-color-regular, #606266);
            border-radius: 12px;
            box-shadow: var(--el-box-shadow, 0 15px 40px rgba(0, 0, 0, 0.25));
            overflow: hidden;
            transform: scale(0.9);
            transition: transform 0.3s;
        }

        .double-shift-modal.active .double-shift-search-box {
            transform: scale(1);
        }

        .double-shift-search-header {
            padding: 20px 25px;
            border-bottom: 1px solid var(--el-border-color-lighter, #eaeaea);
            background-color: var(--el-fill-color-lighter, #f8f9fa);
            display: flex;
            align-items: center;
            gap: 15px;
        }

        .double-shift-search-header i {
            color: var(--el-color-primary, #409eff);
            font-size: 24px;
        }

        .double-shift-search-header span {
            font-size: 1.2rem;
            font-weight: 600;
            color: var(--el-text-color-primary, #303133);
        }

        .double-shift-search-input-container {
            padding: 25px;
            position: relative;
        }

        .double-shift-search-input {
            width: 100%;
            padding: 16px 20px;
            border: 1px solid var(--el-border-color, #dcdfe6);
            border-radius: 4px;
            font-size: 1.1rem;
            outline: none;
            transition: border-color 0.3s;
            background: var(--el-bg-color-overlay, #fff);
            color: var(--el-text-color-regular, #303133);
            caret-color: var(--el-color-primary, #409eff);
        }

        .double-shift-search-input::placeholder {
            color: var(--el-text-color-placeholder, #a8abb2);
        }

        .double-shift-search-input:focus {
            border-color: var(--el-color-primary, #409eff);
        }

        .double-shift-search-results {
            max-height: 450px;
            overflow-y: auto;
            border-top: 1px solid var(--el-border-color-lighter, #eaeaea);
            scrollbar-width: thin;
            scrollbar-color: var(--el-border-color, #dcdfe6) transparent;
        }

        .double-shift-search-results::-webkit-scrollbar {
            width: 8px;
        }

        .double-shift-search-results::-webkit-scrollbar-track {
            background: transparent;
        }

        .double-shift-search-results::-webkit-scrollbar-thumb {
            background-color: var(--el-border-color, #dcdfe6);
            border-radius: 8px;
        }

        .double-shift-search-results::-webkit-scrollbar-thumb:hover {
            background-color: var(--el-text-color-placeholder, #a8abb2);
        }

        .double-shift-search-result-item {
            padding: 18px 25px;
            cursor: pointer;
            border-bottom: 1px solid var(--el-border-color-lighter, #ebeef5);
            transition: background-color 0.2s;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .double-shift-search-result-item:hover {
            background-color: var(--el-fill-color-light, #f5f7fa);
        }

        .double-shift-search-result-item.active {
            background-color: var(--el-color-primary-light-9, #ecf5ff);
            box-shadow: inset 2px 0 0 var(--el-color-primary, #409eff);
        }

        .double-shift-result-title {
            font-weight: 600;
            font-size: 1.1rem;
            color: var(--el-text-color-primary, #303133);
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .double-shift-result-title i {
            color: var(--el-color-primary, #409eff);
            width: 20px;
            text-align: center;
        }

        .double-shift-result-meta {
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 0.9rem;
            flex-wrap: wrap;
        }

        .double-shift-result-tag {
            display: inline-flex;
            align-items: center;
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 0.8rem;
            font-weight: 500;
            line-height: 1.4;
        }

        .double-shift-tag-report {
            background-color: var(--el-color-primary-light-9, #ecf5ff);
            color: var(--el-color-primary, #409eff);
            border: 1px solid var(--el-color-primary-light-8, #d9ecff);
        }

        .double-shift-tag-section {
            background-color: var(--el-color-success-light-9, #f0f9eb);
            color: var(--el-color-success, #67c23a);
            border: 1px solid var(--el-color-success-light-8, #e1f3d8);
        }

        .double-shift-tag-item {
            background-color: var(--el-color-warning-light-9, #fdf6ec);
            color: var(--el-color-warning, #e6a23c);
            border: 1px solid var(--el-color-warning-light-8, #faecd8);
        }

        .double-shift-tag-date {
            background-color: var(--el-color-info-light-9, #f4f4f5);
            color: var(--el-text-color-secondary, #909399);
            border: 1px solid var(--el-color-info-light-8, #e9e9eb);
        }

        .double-shift-tag-status {
            background-color: var(--el-color-danger-light-9, #fef0f0);
            color: var(--el-color-danger, #f56c6c);
            border: 1px solid var(--el-color-danger-light-8, #fde2e2);
        }

        .double-shift-tag-match {
            background-color: var(--el-color-warning-light-9, #fff9e6);
            color: var(--el-color-warning, #e6a23c);
            border: 1px solid var(--el-color-warning-light-8, #faecd8);
        }

        .double-shift-search-footer {
            padding: 18px 25px;
            border-top: 1px solid var(--el-border-color-lighter, #eaeaea);
            background-color: var(--el-fill-color-lighter, #f8f9fa);
            font-size: 0.9rem;
            color: var(--el-text-color-secondary, #909399);
            display: flex;
            justify-content: space-between;
        }

        .double-shift-highlight {
            background-color: var(--el-color-warning-light-8, #fff9c4);
            color: var(--el-text-color-primary, #303133);
            padding: 0 4px;
            border-radius: 3px;
            font-weight: 600;
        }

        .double-shift-empty, .double-shift-loading {
            padding: 40px 25px;
            text-align: center;
            color: var(--el-text-color-secondary, #909399);
            font-size: 0.95rem;
        }

        .double-shift-driver-highlight {
            position: relative;
            z-index: 10001;
        }

        .double-shift-driver-highlight::after {
            content: '';
            position: absolute;
            top: -2px;
            left: -2px;
            right: -2px;
            bottom: -2px;
            border: 2px solid var(--el-color-primary, #409eff);
            border-radius: 4px;
            background-color: rgba(64, 158, 255, 0.1);
            background-color: color-mix(in srgb, var(--el-color-primary, #409eff) 12%, transparent);
            z-index: 10000;
            pointer-events: none;
        }
    `;
    document.head.appendChild(style);

    // 创建搜索模态框
    const modal = document.createElement('div');
    modal.className = 'double-shift-modal';
    modal.innerHTML = `
        <div class="double-shift-search-box">
            <div class="double-shift-search-header">
                <i class="fas fa-search"></i>
                <span>搜索工作周报</span>
            </div>
            <div class="double-shift-search-input-container">
                <input type="text" class="double-shift-search-input" placeholder="输入关键词搜索标题、类型或内容...">
            </div>
            <div class="double-shift-search-results"></div>
            <div class="double-shift-search-footer">
                <span>使用 ↑↓ 选择，Enter 确认，Esc 关闭</span>
                <span class="double-shift-result-count">0 个结果</span>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const searchInput = modal.querySelector('.double-shift-search-input');
    const resultsContainer = modal.querySelector('.double-shift-search-results');
    const resultCount = modal.querySelector('.double-shift-result-count');

    // 用户提示统一走系统插件API（weekReport.ui.toast -> Element Plus），插件不自建通知UI
    function toast(message, type = 'info') {
        window.weekReport?.ui?.toast?.(message, type)
    }

    // ============================================================
    // 工具函数
    // ============================================================

    // 防抖
    function debounce(fn, wait) {
        let timer = null;
        return function(...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), wait);
        };
    }

    // HTML 转义：所有插值先经过它，防注入
    function esc(text) {
        return String(text ?? '').replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    // 正则元字符转义：查询词直接拼 RegExp 前必须转义，否则输入 ( [ \ 等会抛异常
    function escapeRegExp(s) {
        return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // 高亮：在转义后的文本上匹配转义后的查询词（转义逐字符一致，保证命中），再包高亮span
    function highlight(text, query) {
        if (text === null || text === undefined || text === '') return '';
        const escapedText = esc(text);
        if (!query) return escapedText;
        const pattern = escapeRegExp(esc(query));
        return escapedText.replace(new RegExp(`(${pattern})`, 'gi'),
            '<span class="double-shift-highlight">$1</span>');
    }

    // 日期范围守卫
    function fmtRange(dateRange) {
        if (Array.isArray(dateRange) && dateRange[0] && dateRange[1]) {
            return `${dateRange[0]} 至 ${dateRange[1]}`;
        }
        return '未知日期';
    }

    // ============================================================
    // 数据接入：系统插件API
    // ============================================================

    function getApi() {
        return window.weekReport;
    }

    // 全量周报（含sections），API 内部带缓存
    async function fetchAllReports() {
        const api = getApi();
        if (!api || typeof api.reports.search !== 'function') {
            throw new Error('系统插件API(weekReport)不可用，搜索功能无法使用');
        }
        const reports = await api.reports.search();
        return Array.isArray(reports) ? reports : [];
    }

    // ============================================================
    // 搜索匹配（报告标题 / 部分标题 / 工作项 + 动态列）
    // ============================================================

    function searchReports(weeklyReports, query) {
        const results = [];
        const lowerQuery = query.toLowerCase();

        weeklyReports.forEach(report => {
            // 搜索报告标题
            if (report.title && report.title.toLowerCase().includes(lowerQuery)) {
                results.push({
                    reportId: report.id,
                    reportTitle: report.title,
                    matchType: 'report',
                    dateRange: report.dateRange
                });
            }

            // 搜索各部分内容
            (report.sections || []).forEach(section => {
                // 搜索部分标题
                if (section.title && section.title.toLowerCase().includes(lowerQuery)) {
                    results.push({
                        reportId: report.id,
                        reportTitle: report.title,
                        sectionType: section.type,
                        sectionTitle: section.title,
                        sectionIcon: section.icon,
                        matchType: 'section',
                        dateRange: report.dateRange
                    });
                }

                // 搜索项目 - 搜索所有动态列的内容
                (section.items || []).forEach(item => {
                    let matchField = '';
                    let matchValue = '';

                    // 检查项目标题 - 标题是固定重要字段
                    if (item.title && item.title.toLowerCase().includes(lowerQuery)) {
                        matchField = '标题';
                        matchValue = item.title;
                    } else {
                        // 检查所有动态列
                        for (const column of (section.columns || [])) {
                            const prop = column.prop;
                            if (prop === 'title') continue; // 标题已单独检查

                            const value = item[prop];
                            if (value !== undefined && value !== null &&
                                String(value).toLowerCase().includes(lowerQuery)) {
                                matchField = column.label || prop;
                                matchValue = String(value);
                                break;
                            }
                        }
                    }

                    if (matchField) {
                        results.push({
                            reportId: report.id,
                            reportTitle: report.title,
                            sectionType: section.type,
                            sectionTitle: section.title,
                            sectionIcon: section.icon,
                            itemId: item.id,
                            itemTitle: item.title,
                            matchType: 'item',
                            matchField: matchField,
                            matchValue: matchValue,
                            dateRange: report.dateRange,
                            dynamicFields: getDynamicFields(item, section.columns)
                        });
                    }
                });
            });
        });

        return results;
    }

    // 获取动态字段用于显示
    function getDynamicFields(item, columns) {
        const fields = {};
        if (!columns) return fields;

        columns.forEach(column => {
            const prop = column.prop;
            if (prop === 'title') return;

            if (item[prop] !== undefined && item[prop] !== null) {
                fields[column.label || prop] = String(item[prop]);
            }
        });

        return fields;
    }

    // ============================================================
    // Driver 引导
    // ============================================================

    // 清理引导高亮（历史遗留：class 加上后从不清理，反复搜索会累积污染DOM）
    function clearDriverHighlights() {
        document.querySelectorAll('.double-shift-driver-highlight')
            .forEach(el => el.classList.remove('double-shift-driver-highlight'));
    }

    function createDriverGuide(searchQuery) {
        if (typeof Driver === 'undefined') {
            console.warn('Driver.js 未加载，无法创建引导');
            toast('引导功能不可用，请确保已加载Driver.js', 'error');
            return;
        }

        // 等待页面加载完成
        setTimeout(() => {
            const driver = new Driver();
            const steps = [];

            // 模糊匹配所有包含搜索词的元素
            const elements = findElementsWithText(searchQuery);

            if (elements.length === 0) {
                toast('未找到匹配的内容进行引导', 'error');
                return;
            }

            // 为每个匹配的元素创建引导步骤
            elements.forEach((element, index) => {
                let elementText = '';
                if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                    elementText = element.value;
                } else {
                    elementText = element.textContent || element.innerText;
                }

                // 截取匹配的部分文本
                const matchIndex = elementText.toLowerCase().indexOf(searchQuery.toLowerCase());
                const startPos = Math.max(0, matchIndex - 10);
                const endPos = Math.min(elementText.length, matchIndex + searchQuery.length + 10);
                const previewText = elementText.substring(startPos, endPos);

                steps.push({
                    element: element,
                    popover: {
                        title: `匹配内容 ${index + 1}/${elements.length}`,
                        description: `找到匹配内容: "${previewText}"`,
                        position: 'top'
                    },
                    // 引导结束/跳过时清理高亮
                    onReset: clearDriverHighlights,
                    onDestroyed: clearDriverHighlights
                });
            });

            // 启动引导
            if (steps.length > 0) {
                clearDriverHighlights();
                driver.defineSteps(steps);
                driver.start();
                toast(`已启动引导，共 ${steps.length} 个匹配项`, 'success');
            }
        }, 1000);
    }

    // 查找包含搜索文本的所有元素
    function findElementsWithText(searchQuery) {
        const elements = [];
        const lowerQuery = searchQuery.toLowerCase();

        // 获取所有文本节点和输入元素
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
            {
                acceptNode: function(node) {
                    if (node.nodeType === Node.TEXT_NODE) {
                        const text = node.textContent || '';
                        if (text.toLowerCase().includes(lowerQuery)) {
                            return NodeFilter.FILTER_ACCEPT;
                        }
                    } else if (node.nodeType === Node.ELEMENT_NODE) {
                        const tagName = node.tagName.toLowerCase();
                        if ((tagName === 'input' || tagName === 'textarea') &&
                            node.value && node.value.toLowerCase().includes(lowerQuery)) {
                            return NodeFilter.FILTER_ACCEPT;
                        }
                    }
                    return NodeFilter.FILTER_SKIP;
                }
            },
            false
        );

        let node;
        while (node = walker.nextNode()) {
            if (node.nodeType === Node.TEXT_NODE) {
                const parent = node.parentElement;
                if (!parent) continue;

                // 跳过脚本、样式和搜索框自身
                const parentTag = parent.tagName.toLowerCase();
                if (parentTag === 'script' || parentTag === 'style' ||
                    parent.closest('.double-shift-modal')) {
                    continue;
                }

                if (isElementVisible(parent)) {
                    elements.push(parent);
                    parent.classList.add('double-shift-driver-highlight');
                }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                if (isElementVisible(node)) {
                    elements.push(node);
                    node.classList.add('double-shift-driver-highlight');
                }
            }
        }

        return elements.slice(0, 10); // 限制最多10个元素
    }

    // 检查元素是否可见
    function isElementVisible(element) {
        if (!element) return false;

        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
            return false;
        }

        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    // ============================================================
    // 结果渲染（滚动分页）
    // ============================================================

    let currentResults = [];   // 当前查询的完整结果
    let renderedCount = 0;     // 已渲染条数
    let activeQuery = '';      // 当前查询词（滚动分页渲染时使用）
    let requestSeq = 0;        // 请求序号：快速输入时只认最新一次请求，杜绝旧结果覆盖新结果

    function setResultCount(text) {
        resultCount.textContent = text;
    }

    function renderStateRow(text, className) {
        resultsContainer.innerHTML = `<div class="${className || 'double-shift-empty'}">${esc(text)}</div>`;
    }

    // 追加渲染下一页结果
    function renderNextPage(query) {
        if (renderedCount >= currentResults.length) return;

        const fragment = document.createDocumentFragment();
        const end = Math.min(renderedCount + PAGE_SIZE, currentResults.length);
        for (let i = renderedCount; i < end; i++) {
            fragment.appendChild(createResultItem(currentResults[i], query));
        }
        renderedCount = end;
        resultsContainer.appendChild(fragment);
    }

    // 更新计数（含分页进度）
    function updateResultCount(query) {
        if (currentResults.length === 0) {
            setResultCount(query ? '0 个结果' : '暂无周报');
        } else {
            setResultCount(query
                ? `已显示 ${renderedCount}/${currentResults.length} 个结果`
                : `已显示 ${renderedCount}/${currentResults.length} 个周报`);
        }
    }

    // 执行搜索（由防抖包装后调用）
    async function doSearch(query) {
        const seq = ++requestSeq;
        activeQuery = query;
        renderedCount = 0;
        currentResults = [];
        resultsContainer.innerHTML = '';
        // 不预渲染"搜索中..."：数据通常已缓存（脚本加载时预热），空列表一闪即逝

        try {
            const weeklyReports = await fetchAllReports();
            if (seq !== requestSeq) return; // 已有更新的请求，丢弃本次结果

            // 无查询词 = 浏览模式：全部周报按时间倒序，同样走滚动分页（不再截断最近10条）
            currentResults = query
                ? searchReports(weeklyReports, query)
                : weeklyReports.map(r => ({
                    reportId: r.id,
                    reportTitle: r.title,
                    matchType: 'report',
                    dateRange: r.dateRange
                }));

            if (currentResults.length === 0) {
                renderStateRow(query ? '未找到匹配的周报' : '暂无周报记录');
                updateResultCount(query);
                return;
            }

            renderNextPage(query);
            updateResultCount(query);
        } catch (error) {
            if (seq !== requestSeq) return;
            console.error('搜索失败:', error);
            renderStateRow(error.message || '搜索失败');
            setResultCount('搜索失败');
        }
    }

    // 输入防抖
    const onInput = debounce(doSearch, DEBOUNCE_MS);

    // 结果容器滚动触底加载下一页
    resultsContainer.addEventListener('scroll', () => {
        if (renderedCount >= currentResults.length) return;
        const { scrollTop, scrollHeight, clientHeight } = resultsContainer;
        if (scrollTop + clientHeight >= scrollHeight - 40) {
            renderNextPage(activeQuery);
            updateResultCount(activeQuery);
        }
    });

    // ============================================================
    // 模态框与键盘交互
    // ============================================================

    // 双击Shift检测：忽略按住不放的重复触发；命中后归零避免三连击误触
    let lastShiftTime = 0;
    document.addEventListener('keydown', function(event) {
        if (event.key !== 'Shift' || event.repeat) return;

        const currentTime = Date.now();
        if (currentTime - lastShiftTime < 500) {
            lastShiftTime = 0;
            showSearchModal();
        } else {
            lastShiftTime = currentTime;
        }
    });

    // 显示搜索模态框
    function showSearchModal() {
        // 历史遗留：已打开时重复双击会叠加keydown监听，导致一次按键跳两行
        if (modal.classList.contains('active')) return;

        modal.classList.add('active');
        searchInput.value = '';
        setTimeout(() => {
            searchInput.focus();
        }, 100);

        document.addEventListener('keydown', handleKeyDown);
        doSearch('');
    }

    // 隐藏搜索模态框
    function hideSearchModal() {
        modal.classList.remove('active');
        document.removeEventListener('keydown', handleKeyDown);
    }

    // 处理键盘事件
    function handleKeyDown(event) {
        if (event.key === 'Escape') {
            hideSearchModal();
            return;
        }

        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            navigateResults(event.key === 'ArrowDown' ? 1 : -1);
            return;
        }

        if (event.key === 'Enter') {
            event.preventDefault();
            selectCurrentResult();
            return;
        }
    }

    // 获取结果项列表
    function getResultItems() {
        return modal.querySelectorAll('.double-shift-search-result-item');
    }

    // 导航搜索结果（支持跨分页；选中项滚出可视区时自动滚回）
    function navigateResults(direction) {
        let results = getResultItems();
        if (results.length === 0) return;

        let currentIndex = -1;
        results.forEach((result, index) => {
            if (result.classList.contains('active')) {
                currentIndex = index;
            }
        });

        let newIndex = currentIndex + direction;

        // 向下走到已渲染末尾且还有更多结果：先渲染下一页再继续
        if (newIndex >= results.length && renderedCount < currentResults.length) {
            renderNextPage(activeQuery);
            updateResultCount(activeQuery);
            results = getResultItems();
        }

        if (newIndex < 0) newIndex = results.length - 1;
        if (newIndex >= results.length) newIndex = 0;

        results.forEach((result, index) => {
            result.classList.toggle('active', index === newIndex);
        });

        results[newIndex].scrollIntoView({ block: 'nearest' });
    }

    // 选择当前结果（无选中项时默认选第一条）
    function selectCurrentResult() {
        let activeResult = modal.querySelector('.double-shift-search-result-item.active');
        if (!activeResult) {
            const first = getResultItems()[0];
            if (!first) return;
            first.classList.add('active');
            activeResult = first;
        }

        const reportId = Number(activeResult.getAttribute('data-report-id'));
        const searchQuery = searchInput.value.trim();

        const api = getApi();
        if (api && typeof api.ui.selectReport === 'function') {
            api.ui.selectReport(reportId);

            // 创建Driver引导（等待跳转完成后）
            if (searchQuery) {
                setTimeout(() => {
                    createDriverGuide(searchQuery);
                }, 500);
            }
        } else {
            // API 不可用时无统一提示入口可用，只能走控制台
            console.error('系统插件API不可用: weekReport.ui.selectReport');
        }

        hideSearchModal();
    }

    // ============================================================
    // 结果项构建
    // ============================================================

    function createResultItem(result, query = null) {
        const resultItem = document.createElement('div');
        resultItem.className = 'double-shift-search-result-item';
        resultItem.setAttribute('data-report-id', result.reportId);
        resultItem.setAttribute('data-match-type', result.matchType);

        if (result.sectionType) {
            resultItem.setAttribute('data-section-type', result.sectionType);
        }
        if (result.itemId) {
            resultItem.setAttribute('data-item-id', result.itemId);
        }

        // 构建内容（所有插值均转义，高亮只作用于标题行）
        let titleHtml = '';
        let metaHtml = '';

        if (result.matchType === 'report') {
            titleHtml = `<i class="fas fa-file-alt"></i> ${highlight(result.reportTitle, query)}`;
            metaHtml = `<div class="double-shift-result-meta">
                <span class="double-shift-result-tag double-shift-tag-report">周报</span>
                <span class="double-shift-result-tag double-shift-tag-date">${esc(fmtRange(result.dateRange))}</span>
            </div>`;
        } else if (result.matchType === 'section') {
            titleHtml = `<i class="${esc(result.sectionIcon || 'fas fa-folder')}"></i> ${highlight(result.sectionTitle, query)}`;
            metaHtml = `<div class="double-shift-result-meta">
                <span class="double-shift-result-tag double-shift-tag-report">${esc(result.reportTitle)}</span>
                <span class="double-shift-result-tag double-shift-tag-section">${esc(result.sectionTitle)}</span>
                <span class="double-shift-result-tag double-shift-tag-date">${esc(fmtRange(result.dateRange))}</span>
            </div>`;
        } else {
            // 项目结果
            titleHtml = `<i class="${esc(result.sectionIcon || 'fas fa-list')}"></i> ${highlight(result.itemTitle, query)}`;

            let matchInfo = '';
            if (result.matchField && result.matchValue) {
                matchInfo = `<span class="double-shift-result-tag double-shift-tag-match">@${esc(result.matchField)}</span>`;
            }

            // 动态添加其他字段标签
            let dynamicTags = '';
            if (result.dynamicFields) {
                for (const [field, value] of Object.entries(result.dynamicFields)) {
                    if (field === result.matchField) continue;

                    let tagClass = 'double-shift-tag-item';
                    if (field.toLowerCase().includes('date')) {
                        tagClass = 'double-shift-tag-date';
                    } else if (field.toLowerCase().includes('status')) {
                        tagClass = 'double-shift-tag-status';
                    }

                    dynamicTags += `<span class="double-shift-result-tag ${tagClass}">${esc(field)}: ${esc(value)}</span>`;
                }
            }

            metaHtml = `<div class="double-shift-result-meta">
                <span class="double-shift-result-tag double-shift-tag-report">${esc(result.reportTitle)}</span>
                <span class="double-shift-result-tag double-shift-tag-section">${esc(result.sectionTitle)}</span>
                ${dynamicTags}
                ${matchInfo}
            </div>`;
        }

        resultItem.innerHTML = `
            <div class="double-shift-result-title">${titleHtml}</div>
            ${metaHtml}
        `;

        // 添加点击事件
        resultItem.addEventListener('click', function() {
            getResultItems().forEach(item => {
                item.classList.remove('active');
            });
            this.classList.add('active');
            selectCurrentResult();
        });

        return resultItem;
    }

    // ============================================================
    // 初始化
    // ============================================================

    // 输入搜索内容时更新结果（防抖）
    searchInput.addEventListener('input', function() {
        onInput(this.value.trim());
    });

    // 点击模态框背景关闭搜索框
    modal.addEventListener('click', function(event) {
        if (event.target === modal) {
            hideSearchModal();
        }
    });

    // 显示使用提示
    setTimeout(() => {
        toast('提示: 双击Shift键打开搜索框');
    }, 2000);

    // 预热数据缓存：后台先取全量周报，首次打开搜索框即刻出列表
    fetchAllReports().catch((e) => console.error('搜索缓存预热失败:', e));
})();
