(function() {
    
    // ============================
    // 0. 启动提示 (新增 Warning)
    // ============================
    console.clear();
    console.log("%c[SDU选课助手] 启动中...", "color: #fff; background: #2563eb; padding: 6px;");
    console.warn("🔔 [适用场景提示] 本脚本仅用于蹲守“回流课”（捡漏别人退选的课程）。\n⚠️ 请勿在选课刚开放的高峰期（秒杀阶段）使用，以免造成账号风险！");
    
    // ============================
    // 1. 交互配置
    // ============================
    const inputId = prompt("请输入课程编号 (如 sd116100A0):", "26318050");
    if (!inputId) return;
    const inputSeq = prompt("请输入课序号 (如 301):", "902");
    if (!inputSeq) return;
    
    const inputInterval = prompt("请输入点击间隔 (毫秒) [建议: 1500]:", "1500");
    const LOOP_INTERVAL = parseInt(inputInterval) || 1500;

    console.log(`%c[智能版] 目标: ${inputId}-${inputSeq} | 频率: ${LOOP_INTERVAL}ms`, "color: #fff; background: #ea580c; padding: 6px;");

    // 全局状态标记
    let isSearchSuccess = false; // 标记搜索是否成功

    // ============================
    // 2. 模块一：自动搜索 (返回布尔值)
    // ============================
    function tryAutoSearch() {
        console.log(">>> [步骤1] 尝试自动填表搜索...");
        
        let docs = getLiveDocs();
        let success = false;

        for (let doc of docs) {
            try {
                // 1. 寻找文本输入框
                const allInputs = Array.from(doc.querySelectorAll('input[type="text"]'));
                const visibleInputs = allInputs.filter(i => i.offsetParent !== null && i.style.display !== 'none');
                
                // 优先找 placeholder 包含“课程”的，或者找第一个可见的
                let targetInput = visibleInputs.find(i => i.placeholder && i.placeholder.includes("课程"));
                if (!targetInput && visibleInputs.length > 0) {
                    targetInput = visibleInputs.find(i => !i.className.includes("date")); 
                }

                if (targetInput) {
                    // 2. 填入数据
                    targetInput.value = inputId;
                    targetInput.dispatchEvent(new Event('input'));
                    targetInput.dispatchEvent(new Event('change'));
                    
                    // 3. 点击查询
                    const searchBtn = Array.from(doc.querySelectorAll('button, input[type="button"], input[type="submit"]'))
                        .find(b => b.innerText.trim() === "查询" || b.value === "查询");
                    
                    if (searchBtn) {
                        searchBtn.click();
                        console.log(`✅ [搜索成功] 已填入 ${inputId} 并点击查询。`);
                        success = true;
                        break; 
                    }
                }
            } catch (e) {}
        }
        
        return success;
    }

    // ============================
    // 3. 模块二：强制显示 200 条 (备用方案)
    // ============================
    function forceExpandTable() {
        console.log(">>> [步骤2] 搜索未生效，执行备用方案：强制展开表格...");
        
        const frames = [window];
        document.querySelectorAll('iframe').forEach(f => {
            try { if(f.contentWindow) frames.push(f.contentWindow); } catch(e){}
        });

        frames.forEach(win => {
            try {
                if (win.$ && win.$.fn && win.$.fn.dataTable) {
                    var tables = win.$.fn.dataTable.fnTables(true);
                    if (tables.length > 0) {
                        var oTable = win.$(tables[0]).dataTable();
                        var oSettings = oTable.fnSettings();
                        oSettings._iDisplayLength = 200; 
                        oSettings._iDisplayStart = 0;    
                        oTable.fnDraw();
                        console.log(`✅ [展开] 窗口 "${win.name}" 表格已设为 200 行。`);
                    }
                }
            } catch (e) {}
        });
    }

    // ============================
    // 4. 工具函数
    // ============================
    function getLiveDocs() {
        let docs = [document];
        document.querySelectorAll('iframe').forEach(f => {
            try {
                let doc = f.contentDocument || (f.contentWindow ? f.contentWindow.document : null);
                if (doc && doc.readyState === 'complete') {
                    docs.push(doc);
                    injectProtection(f.contentWindow);
                }
            } catch(e){}
        });
        injectProtection(window);
        return docs;
    }

    function injectProtection(win) {
        try {
            if (!win || win.isProtected) return;
            win.alert = function(msg) {
                console.log(`[拦截弹窗] ${msg}`);
                if (msg && msg.includes("成功")) {
                    console.log("%c🎉 抢课成功！🎉", "color: red; font-size: 30px; font-weight: bold;");
                    delete win.alert; win.alert("恭喜！抢课成功！");
                    window.location.reload(); 
                }
            };
            win.confirm = () => true;
            win.onerror = () => true; 
            win.isProtected = true; 
        } catch(e) {}
    }

    // ============================
    // 5. 执行流程 (核心修改)
    // ============================
    
    // 第一步：尝试搜索
    isSearchSuccess = tryAutoSearch();

    // 第二步：根据搜索结果决定是否展开
    setTimeout(() => {
        if (isSearchSuccess) {
            console.log("✨ 搜索功能正常，跳过表格展开步骤。");
        } else {
            console.warn("⚠️ 自动搜索失败 (未找到输入框)，启动【展开】兜底...");
            forceExpandTable();
        }
    }, 500); // 稍作延迟等待DOM反应

    let useQueryMode = false; 
    let isBusy = false;       

    // 第三步：启动循环
    setTimeout(() => {
        console.log(">>> 脚本正式启动抢课循环...");
        
        setInterval(() => {
            if (isBusy) return;

            try {
                // A. 掉线检测
                if (document.body.innerText.includes("欢迎登录")) {
                    alert("已掉线，请重新登录！");
                    return;
                }

                const docs = getLiveDocs();

                // --- 模式 1: 极速点击 ---
                if (!useQueryMode) {
                    let status = "NO_ROW"; 
                    let targetBtn = null;

                    for (let doc of docs) {
                        const rows = Array.from(doc.querySelectorAll('tr'));
                        const targetRow = rows.find(r => 
                            r.innerText.includes(inputId) && 
                            r.innerText.includes(inputSeq)
                        );
                        if (targetRow) {
                            if (targetRow.innerText.includes("退课") || targetRow.innerText.includes("已选")) {
                                status = "SELECTED"; break;
                            }
                            const btn = Array.from(targetRow.querySelectorAll('a, button, span')).find(el => 
                                el.innerText.trim() === "选课" && el.offsetParent !== null
                            );
                            if (btn) {
                                status = "FOUND"; targetBtn = btn; break;
                            } else {
                                status = "MISSING"; break; 
                            }
                        }
                    }

                    if (status === "FOUND") {
                        targetBtn.click();
                        console.log(`[点击] ${new Date().toLocaleTimeString().split(' ')[0]}`);
                    } else if (status === "MISSING") {
                        console.warn(">>> 检测到按钮消失！切换至【查询重置模式】");
                        useQueryMode = true; 
                    } else if (status === "SELECTED") {
                        console.log("已选上，停止。");
                        window.location.reload();
                        return;
                    }
                }

                // --- 模式 2: 查询重置 ---
                if (useQueryMode) {
                    isBusy = true;
                    // 点击查询
                    let qClicked = false;
                    for (let doc of docs) {
                        const btn = Array.from(doc.querySelectorAll('button, input[type="button"]')).find(b => b.innerText.trim() === "查询" || b.value === "查询");
                        if (btn) { btn.click(); qClicked = true; break; }
                    }
                    if(!qClicked) console.log("未找到查询按钮...");

                    setTimeout(() => {
                        if (!isSearchSuccess) {
                            forceExpandTable();
                        }

                        const newDocs = getLiveDocs();
                        for (let doc of newDocs) {
                            const rows = Array.from(doc.querySelectorAll('tr'));
                            const targetRow = rows.find(r => r.innerText.includes(inputId) && r.innerText.includes(inputSeq));
                            if (targetRow) {
                                const btn = Array.from(targetRow.querySelectorAll('a, button, span')).find(el => el.innerText.trim() === "选课" && el.offsetParent !== null);
                                if (btn) { btn.click(); console.log("[查询后点击] OK"); break; }
                            }
                        }
                        isBusy = false;
                    }, 2500);
                }

            } catch (e) { isBusy = false; }
        }, LOOP_INTERVAL);

    }, 1500);

})();
