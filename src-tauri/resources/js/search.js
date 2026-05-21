// 双击Shift搜索框实现
(function() {
    // 创建样式
    const style = document.createElement('style');
    style.textContent = `
        .double-shift-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.7);
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
            background-color: white;
            border-radius: 12px;
            box-shadow: 0 15px 40px rgba(0, 0, 0, 0.25);
            overflow: hidden;
            transform: scale(0.9);
            transition: transform 0.3s;
        }
        
        .double-shift-modal.active .double-shift-search-box {
            transform: scale(1);
        }
        
        .double-shift-search-header {
            padding: 20px 25px;
            border-bottom: 1px solid #eaeaea;
            background-color: #f8f9fa;
            display: flex;
            align-items: center;
            gap: 15px;
        }
        
        .double-shift-search-header i {
            color: #409EFF;
            font-size: 24px;
        }
        
        .double-shift-search-header span {
            font-size: 1.2rem;
            font-weight: 600;
            color: #303133;
        }
        
        .double-shift-search-input-container {
            padding: 25px;
            position: relative;
        }
        
        .double-shift-search-input {
            width: 100%;
            padding: 16px 20px;
            border: 1px solid #DCDFE6;
            border-radius: 4px;
            font-size: 1.1rem;
            outline: none;
            transition: border-color 0.3s;
            background: white;
        }
        
        .double-shift-search-input:focus {
            border-color: #409EFF;
        }
        
        .double-shift-search-results {
            max-height: 450px;
            overflow-y: auto;
            border-top: 1px solid #eaeaea;
        }
        
        .double-shift-search-result-item {
            padding: 18px 25px;
            cursor: pointer;
            border-bottom: 1px solid #EBEEF5;
            transition: background-color 0.2s;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        
        .double-shift-search-result-item:hover {
            background-color: #F5F7FA;
        }
        
        .double-shift-search-result-item.active {
            background-color: #ECF5FF;
        }
        
        .double-shift-result-title {
            font-weight: 600;
            font-size: 1.1rem;
            color: #303133;
            display: flex;
            align-items: center;
            gap: 12px;
        }
        
        .double-shift-result-title i {
            color: #409EFF;
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
            background-color: #ECF5FF;
            color: #409EFF;
            border: 1px solid #D9ECFF;
        }
        
        .double-shift-tag-section {
            background-color: #F0F9FF;
            color: #67C23A;
            border: 1px solid #E1F3D8;
        }
        
        .double-shift-tag-item {
            background-color: #FDF6EC;
            color: #E6A23C;
            border: 1px solid #FAECD8;
        }
        
        .double-shift-tag-date {
            background-color: #F4F4F5;
            color: #909399;
            border: 1px solid #E9E9EB;
        }
        
        .double-shift-tag-status {
            background-color: #FEF0F0;
            color: #F56C6C;
            border: 1px solid #FDE2E2;
        }
        
        .double-shift-tag-match {
            background-color: #FFF9E6;
            color: #E6A23C;
            border: 1px solid #FAECD8;
        }
        
        .double-shift-search-footer {
            padding: 18px 25px;
            border-top: 1px solid #eaeaea;
            background-color: #f8f9fa;
            font-size: 0.9rem;
            color: #909399;
            display: flex;
            justify-content: space-between;
        }
        
        .double-shift-highlight {
            background-color: #FFF9C4;
            padding: 0 4px;
            border-radius: 3px;
            font-weight: 600;
        }
        
        .double-shift-notification {
            position: fixed;
            bottom: 30px;
            right: 30px;
            padding: 15px 25px;
            background: #67C23A;
            color: white;
            border-radius: 4px;
            box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
            z-index: 10000;
            opacity: 0;
            transform: translateY(20px);
            transition: opacity 0.3s, transform 0.3s;
            max-width: 400px;
        }
        
        .double-shift-notification.active {
            opacity: 1;
            transform: translateY(0);
        }
        
        .double-shift-notification.error {
            background: #F56C6C;
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
            border: 2px solid #409EFF;
            border-radius: 4px;
            background-color: rgba(64, 158, 255, 0.1);
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

    // 创建通知
    const notification = document.createElement('div');
    notification.className = 'double-shift-notification';
    document.body.appendChild(notification);

    // 显示通知
    function showNotification(message, isError = false) {
        notification.textContent = message;
        notification.classList.toggle('error', isError);
        notification.classList.add('active');

        setTimeout(() => {
            notification.classList.remove('active');
        }, 3000);
    }

    // 获取周报数据
    function getWeeklyReports() {
        try {
            const reports = localStorage.getItem('weeklyReports');
            return reports ? JSON.parse(reports) : [];
        } catch (error) {
            console.error('获取周报数据失败:', error);
            return [];
        }
    }

    // 创建Driver引导
    function createDriverGuide(searchQuery, selectedReportId) {
        // 检查Driver是否可用
        if (typeof Driver === 'undefined') {
            console.warn('Driver.js 未加载，无法创建引导');
            showNotification('引导功能不可用，请确保已加载Driver.js', true);
            return;
        }

        // 等待页面加载完成
        setTimeout(() => {
            const driver = new Driver();
            const steps = [];

            // 模糊匹配所有包含搜索词的元素
            const elements = findElementsWithText(searchQuery);

            if (elements.length === 0) {
                showNotification('未找到匹配的内容进行引导', true);
                return;
            }

            // 为每个匹配的元素创建引导步骤
            elements.forEach((element, index) => {
                // 获取元素的文本内容
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

                const step = {
                    element: element,
                    popover: {
                        title: `匹配内容 ${index + 1}/${elements.length}`,
                        description: `找到匹配内容: "${previewText}"`,
                        position: 'top'
                    }
                };

                steps.push(step);
            });

            // 启动引导
            if (steps.length > 0) {
                driver.defineSteps(steps);
                driver.start();
                showNotification(`已启动引导，共 ${steps.length} 个匹配项`);
            }
        }, 1000); // 等待1秒确保页面加载完成
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
                    // 检查文本节点
                    if (node.nodeType === Node.TEXT_NODE) {
                        const text = node.textContent || '';
                        if (text.toLowerCase().includes(lowerQuery)) {
                            return NodeFilter.FILTER_ACCEPT;
                        }
                    }
                    // 检查输入元素
                    else if (node.nodeType === Node.ELEMENT_NODE) {
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
                // 对于文本节点，获取其父元素
                let parent = node.parentElement;

                // 跳过脚本和样式元素
                if (parent.tagName.toLowerCase() === 'script' ||
                    parent.tagName.toLowerCase() === 'style') {
                    continue;
                }

                // 确保元素是可见的
                if (isElementVisible(parent)) {
                    elements.push(parent);

                    // 添加高亮样式
                    parent.classList.add('double-shift-driver-highlight');
                }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                // 对于输入元素，直接添加
                if (isElementVisible(node)) {
                    elements.push(node);

                    // 添加高亮样式
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

    // 双击Shift检测逻辑
    let lastShiftTime = 0;
    let shiftCount = 0;
    let shiftTimer = null;

    // 监听键盘按下事件
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Shift') {
            const currentTime = new Date().getTime();

            // 清除之前的计时器
            if (shiftTimer) {
                clearTimeout(shiftTimer);
            }

            // 检查是否为双击（两次按下间隔小于500ms）
            if (currentTime - lastShiftTime < 500) {
                // 双击Shift，显示搜索框
                showSearchModal();
                shiftCount = 0;
            } else {
                shiftCount = 1;
            }

            lastShiftTime = currentTime;

            // 设置计时器，如果500ms内没有再次按下Shift，则重置计数
            shiftTimer = setTimeout(() => {
                shiftCount = 0;
            }, 500);
        }
    });

    // 显示搜索模态框
    function showSearchModal() {
        const searchInput = modal.querySelector('.double-shift-search-input');

        modal.classList.add('active');
        setTimeout(() => {
            searchInput.focus();
        }, 100);
        searchInput.value = '';

        // 初始化搜索结果
        updateSearchResults('');

        // 添加ESC键关闭功能
        document.addEventListener('keydown', handleKeyDown);
    }

    // 隐藏搜索模态框
    function hideSearchModal() {
        modal.classList.remove('active');

        // 移除事件监听
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

    // 导航搜索结果
    function navigateResults(direction) {
        const results = modal.querySelectorAll('.double-shift-search-result-item');
        let currentIndex = -1;

        // 查找当前选中的结果
        results.forEach((result, index) => {
            if (result.classList.contains('active')) {
                currentIndex = index;
            }
        });

        // 计算新的选中索引
        let newIndex = currentIndex + direction;
        if (newIndex < 0) newIndex = results.length - 1;
        if (newIndex >= results.length) newIndex = 0;

        // 更新选中状态
        results.forEach((result, index) => {
            result.classList.toggle('active', index === newIndex);
        });
    }

    // 选择当前结果
    function selectCurrentResult() {
        const activeResult = modal.querySelector('.double-shift-search-result-item.active');
        if (activeResult) {
            const reportId = parseInt(activeResult.getAttribute('data-report-id'));
            const searchQuery = modal.querySelector('.double-shift-search-input').value;

            // 调用全局函数selectReport
            if (typeof window.selectReport === 'function') {
                window.selectReport(reportId);

                // 创建Driver引导（等待跳转完成后）
                if (searchQuery) {
                    setTimeout(() => {
                        createDriverGuide(searchQuery, reportId);
                    }, 500);
                }
            } else {
                // 备用方案
                showNotification(`已选择报告: ${activeResult.querySelector('.double-shift-result-title').textContent}`);
                console.warn('全局函数未找到: window.selectReport');
            }

            hideSearchModal();
        }
    }

    // 更新搜索结果
    function updateSearchResults(query) {
        const resultsContainer = modal.querySelector('.double-shift-search-results');
        const resultCount = modal.querySelector('.double-shift-result-count');

        // 清空现有结果
        resultsContainer.innerHTML = '';

        // 获取周报数据
        const weeklyReports = getWeeklyReports();

        // 如果没有查询词，显示最近的报告
        if (!query) {
            const recentReports = getRecentReports(weeklyReports);
            resultCount.textContent = `${recentReports.length} 个最近报告`;

            recentReports.forEach(report => {
                const resultItem = createResultItem(report);
                resultsContainer.appendChild(resultItem);
            });
            return;
        }

        // 搜索匹配的报告
        const searchResults = searchReports(weeklyReports, query);
        resultCount.textContent = `${searchResults.length} 个结果`;

        // 添加搜索结果
        searchResults.forEach(result => {
            const resultItem = createResultItem(result, query);
            resultsContainer.appendChild(resultItem);
        });
    }

    // 获取最近的报告（用于无搜索词时显示）
    function getRecentReports(weeklyReports) {
        return weeklyReports.slice(0, 8).map(report => ({
            reportId: report.id,
            reportTitle: report.title,
            matchType: 'report',
            dateRange: report.dateRange
        }));
    }

    // 搜索报告
    function searchReports(weeklyReports, query) {
        const results = [];
        const lowerQuery = query.toLowerCase();

        weeklyReports.forEach(report => {
            // 搜索报告标题
            if (report.title.toLowerCase().includes(lowerQuery)) {
                results.push({
                    reportId: report.id,
                    reportTitle: report.title,
                    matchType: 'report',
                    dateRange: report.dateRange
                });
            }

            // 搜索各部分内容
            report.sections.forEach(section => {
                // 搜索部分标题
                if (section.title.toLowerCase().includes(lowerQuery)) {
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
                section.items.forEach(item => {
                    let itemMatched = false;
                    let matchField = '';
                    let matchValue = '';

                    // 检查项目标题 - 标题是固定重要字段
                    if (item.title && item.title.toLowerCase().includes(lowerQuery)) {
                        itemMatched = true;
                        matchField = '标题';
                        matchValue = item.title;
                    }
                    // 检查所有动态列
                    else if (section.columns) {
                        for (const column of section.columns) {
                            const prop = column.prop;
                            // 跳过标题列，因为标题已经单独检查过了
                            if (prop === 'title') continue;

                            // 检查列的值是否存在并包含搜索词
                            if (item[prop] !== undefined && item[prop] !== null) {
                                const value = String(item[prop]);
                                if (value.toLowerCase().includes(lowerQuery)) {
                                    itemMatched = true;
                                    matchField = column.label || prop;
                                    matchValue = value;
                                    break;
                                }
                            }
                        }
                    }

                    if (itemMatched) {
                        results.push({
                            reportId: report.id,
                            reportTitle: report.title,
                            sectionType: section.type,
                            sectionTitle: section.title,
                            sectionIcon: section.icon,
                            itemId: item.id,
                            itemTitle: item.title, // 固定标题字段
                            matchType: 'item',
                            matchField: matchField,
                            matchValue: matchValue,
                            dateRange: report.dateRange,
                            // 动态添加其他字段用于显示
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
            // 跳过标题字段，因为它已经单独处理
            if (prop === 'title') return;

            if (item[prop] !== undefined && item[prop] !== null) {
                fields[column.label || prop] = String(item[prop]);
            }
        });

        return fields;
    }

    // 创建结果项
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

        // 高亮文本
        const highlightText = (text) => {
            if (!query || !text) return text;
            const regex = new RegExp(`(${query})`, 'gi');
            return text.replace(regex, '<span class="double-shift-highlight">$1</span>');
        };

        // 构建内容
        let titleHtml = '';
        let metaHtml = '';

        if (result.matchType === 'report') {
            titleHtml = `<i class="fas fa-file-alt"></i> ${highlightText(result.reportTitle)}`;
            metaHtml = `<div class="double-shift-result-meta">
                <span class="double-shift-result-tag double-shift-tag-report">周报</span>
                <span class="double-shift-result-tag double-shift-tag-date">${result.dateRange[0]} 至 ${result.dateRange[1]}</span>
            </div>`;
        } else if (result.matchType === 'section') {
            titleHtml = `<i class="${result.sectionIcon}"></i> ${highlightText(result.sectionTitle)}`;
            metaHtml = `<div class="double-shift-result-meta">
                <span class="double-shift-result-tag double-shift-tag-report">${result.reportTitle}</span>
                <span class="double-shift-result-tag double-shift-tag-section">${result.sectionTitle}</span>
                <span class="double-shift-result-tag double-shift-tag-date">${result.dateRange[0]} 至 ${result.dateRange[1]}</span>
            </div>`;
        } else {
            // 项目结果
            titleHtml = `<i class="${result.sectionIcon}"></i> ${highlightText(result.itemTitle)}`;

            let matchInfo = '';
            if (result.matchField && result.matchValue) {
                matchInfo = `<span class="double-shift-result-tag double-shift-tag-match">@${result.matchField}</span>`;
            }

            // 动态添加其他字段标签
            let dynamicTags = '';
            if (result.dynamicFields) {
                for (const [field, value] of Object.entries(result.dynamicFields)) {
                    // 跳过匹配字段，因为它已经单独显示
                    if (field === result.matchField) continue;

                    // 为不同类型的字段使用不同的标签样式
                    let tagClass = 'double-shift-tag-item';
                    if (field.toLowerCase().includes('date')) {
                        tagClass = 'double-shift-tag-date';
                    } else if (field.toLowerCase().includes('status')) {
                        tagClass = 'double-shift-tag-status';
                    }

                    dynamicTags += `<span class="double-shift-result-tag ${tagClass}">${field}: ${value}</span>`;
                }
            }

            metaHtml = `<div class="double-shift-result-meta">
                <span class="double-shift-result-tag double-shift-tag-report">${result.reportTitle}</span>
                <span class="double-shift-result-tag double-shift-tag-section">${result.sectionTitle}</span>
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
            modal.querySelectorAll('.double-shift-search-result-item').forEach(item => {
                item.classList.remove('active');
            });
            this.classList.add('active');
            selectCurrentResult();
        });

        return resultItem;
    }

    // 初始化搜索功能
    const searchInput = modal.querySelector('.double-shift-search-input');

    // 输入搜索内容时更新结果
    searchInput.addEventListener('input', function() {
        updateSearchResults(this.value);
    });

    // 点击模态框背景关闭搜索框
    modal.addEventListener('click', function(event) {
        if (event.target === modal) {
            hideSearchModal();
        }
    });

    // 显示使用提示
    setTimeout(() => {
        showNotification('提示: 双击Shift键打开搜索框', false);
    }, 2000);
})();