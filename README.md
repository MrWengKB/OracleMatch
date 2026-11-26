# OracleMatch
汉字小时候：你认识它们吗？

甲骨文配对游戏：把甲骨文和今天的汉字（楷书）配成一对。玩法和 [HanziMatch](https://github.com/MrWengKB/HanziMatch) 一致。

【玩法】
1. 先选年级，再选单个课次或整个年级，并可选择每局字数（6、10、15、20、30，字数不够时全部使用），或输入自定义字表。
2. 点一张甲骨文卡、再点一张楷书卡，是同一个字就消除。全部消除即过关，并显示用时。
3. “翻翻乐”模式较难：先看 3 秒，卡片翻过去后要凭记忆翻开可以配对的两张。

【字库】
- `oraclelist.csv`：从 [HanziQuery](https://github.com/MrWengKB/HanziQuery) 的 hanzilist.csv（一至四年级上册识读字）精简而来，只保留有甲骨文的字，共 414 字。栏位：年级, 课次, 生字, 甲骨文字。
- 甲骨文字形使用免费的方正甲骨文字体，检测方法与 HanziQuery 相同（`tools/check_oracle.py`）：字体里有这个字且字形不是空白才算有；简体字找不到时改查对应的繁体字，「甲骨文字」栏记录实际显示用的字。
- 网页只加载精简后的字体（`fonts/oracle.woff2`、`fonts/kaiti.woff2`，共约 300 KB），手机打开也快。

【更新字库】
HanziQuery 加了新字以后：
```
cp ../HanziQuery/hanzilist.csv tools/
cd tools
pip install fonttools brotli opencc-python-reimplemented
python3 build_oraclelist.py
```
脚本会重新生成 `oraclelist.csv` 和 `fonts/` 里的精简字体。

【本地运行】
在文件夹里运行 `python3 -m http.server`，再打开 http://localhost:8000 （直接双击 index.html 的话浏览器不允许读取 csv）。
