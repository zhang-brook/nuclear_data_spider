(function () {
    'use strict'

    const pages = [
        { file: 'index.html', label: '首页' },
        { file: 'query.html', label: '数据列表' },
        { file: 'chart.html', label: '数据曲线' },
        { file: 'basic.html', label: '基础查询' },
    ]

    function el(tag, className, text) {
        const node = document.createElement(tag)
        if (className) node.className = className
        if (text !== undefined) node.textContent = text
        return node
    }

    function link(href, text, title = undefined) {
        const node = el('a', '', text)
        node.href = href
        node.target = '_blank'
        node.rel = 'noopener'
        if (title !== undefined) {
            node.title = title
        }
        return node
    }

    async function copyText(text) {
        try {
            await navigator.clipboard.writeText(text)
            return true
        } catch (error) {
            const area = document.createElement('textarea')
            area.value = text
            area.setAttribute('readonly', '')
            area.style.position = 'fixed'
            area.style.top = '-1000px'
            document.body.appendChild(area)
            area.select()
            let copied = false
            try {
                copied = document.execCommand('copy')
            } catch (fallbackError) {
                copied = false
            }
            area.remove()
            return copied
        }
    }

    function typeText(type) {
        if (type === '0') return '环境质量监测点'
        if (type === '1') return '核电厂监测点'
        return type ?? ''
    }

    function rowCopyText(row, dateText) {
        const date = dateText || row.date || ''
        const rawDate = row.date && row.date !== date ? ` (${row.date})` : ''
        return [
            `名称：${row.name || ''}`,
            `位置：${row.location || ''}`,
            `值：${row.value || ''}`,
            `日期：${date}${rawDate}`,
            `类型：${typeText(row.type)}`,
            `数据更新日期：${row.time || '暂无'}`,
        ].join('\n')
    }

    window.siteUtils = { copyText, rowCopyText }

    function buildNav() {
        const host = document.getElementById('site-nav')
        if (!host) return

        const inner = el('div', 'wrap topbar-inner')
        const brand = el('a', 'brand')
        brand.href = './index.html'
        brand.appendChild(el('h1', '', '辐射环境监测数据'))
        brand.appendChild(el('p', '', '国家核安全局公开数据'))

        const nav = el('nav', 'nav')
        const current = (location.pathname.split('/').pop() || 'index.html').toLowerCase()
        for (const page of pages) {
            const item = el('a', '', page.label)
            item.href = './' + page.file
            if (page.file === current) {
                item.classList.add('active')
                item.setAttribute('aria-current', 'page')
            }
            nav.appendChild(item)
        }

        inner.append(brand, nav)
        host.appendChild(inner)
    }

    function buildFooter() {
        const host = document.getElementById('site-footer')
        if (!host) return

        const inner = el('div', 'wrap')

        const source = el('p')
        source.append('数据来源：',
            link('https://nnsa.mee.gov.cn/', '国家核安全局', '国家核安全局官方网站'),
            // link('https://www.rmtc.org.cn/', '生态环境部辐射环境监测技术中心', '生态环境部辐射环境监测技术中心 - 环境质量 - 实时数据 - 全国空气吸收剂量率发布系统'),
            ' - ',
            link('https://data.rmtc.org.cn/gis', '辐射环境监测数据', '辐射环境监测数据'),
            '；本站仅通过技术层面保存监测数据历史记录', // '，方便学术研究使用',
        )

        const project = el('p')
        project.append(
            '开源项目：',
            link('https://github.com/zhang-brook/nuclear_data_spider', 'GitHub'),
            ' · ',
            link('https://gitee.com/zhang-brook/nuclear_data_spider', 'Gitee'),
            ' · ',
            link('https://www.only4.work/about/feedback/', '留言反馈'),
        )

        const notice = el('p')
        notice.append(
            '免责声明：本站仅记录自 2023-08-25 起的辐射环境监测数据历史值，不对数据来源真实性、服务稳定性做保证；数据仅供学习研究使用，使用者需自行承担风险',
        )

        const textGetData = el('p')
        textGetData.append(
            '数据下载：请勿使用爬虫爬取本站接口，如需全部历史数据请留言获取',
        )

        inner.append(project, source, notice, textGetData)
        host.appendChild(inner)
    }

    buildNav()
    buildFooter()
})()
