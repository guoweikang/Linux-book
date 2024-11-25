$(function(){
	let visgraph = null;
	//可视化默认配置
	const config = {
		node:{ //节点的默认配置
			label:{ //标签配置
				show:true, //是否显示
				color:'250,250,250',//字体颜色
				font:'normal 30px KaiTi',//字体大小及类型 LiSu Arial
				textPosition:'Bottom_Center',//文字位置 Top_Center,Bottom_Center,Middle_Right,Middle_Center
				//borderWidth:1,
				//borderColor:'100,250,150',
				//textOffsetY:4,
				//backgroud:'250,250,250'
			},
			shape:'circle',//自定义节点时默认都是在rect包裹内部绘制
			size:100,
			color:'30,160,255',
			borderColor: '200,200,200', //边框颜色
			borderWidth: 0, //边框宽度,
			borderRadius: 0, //边框圆角大小
			lineDash: [0], //边框虚线间隔,borderWidth>0时生效
			alpha: 1, //节点透明度
			selected: { //选中时的样式设置
				borderColor: '238,238,0', //选中时边框颜色
				borderAlpha: 1, //选中时的边框透明度
				borderWidth: 3, //选中是的边框宽度
				showShadow: true, //是否展示阴影
				shadowColor: '238,238,0' //选中是的阴影颜色
			},
			onClick:function(event,node){
				findNode(node);
			}
		},
		link: { //连线的默认配置
			label: { //连线标签
				show: false, //是否显示
				color: '100,100,200', //字体颜色
				font: 'normal 8px Arial', //字体大小及类型
				//borderColor:'100,200,125',
				backgroud:'200,200,200'
			},
			lineType: 'direct', //连线类型,curver,vlink,hlink,vbezier,hbezier
			colorType: 'defined', //连线颜色类型 source:继承source颜色,target:继承target颜色 both:用双边颜色，d:自定义
			color: '200,200,200', //连线颜色
			alpha: 1, // 连线透明度
			lineWidth: 8, //连线宽度
			lineDash: [0], //虚线间隔样式如：[5,8]
			showArrow: false, //显示连线箭头
			selected: { //选中时的样式设置
				color: '20,250,50', //选中时的颜色
				alpha: 1,
				lineWidth: 4,
				showShadow: false, //是否展示阴影
				shadowColor: '50,250,50', //选中连线时的阴影颜色
			}
		},
		highLightNeiber:true,
		wheelZoom:0.8
	};
	
	//1、初始化图对象
	visgraph = new VisGraph(document.getElementById('graph-panel'),config);
	//visgraph.switchAnimate(true);//开启动画模式
	visgraph.setShowDetailScale(0.1);//显示详细
	
	//示例数据
	var demoData = {"nodes":[{"id":"10","label":"数据中台","x":-63,"y":-91,"width":"260","height":"260","color":"230,107,183"},{"id":"100","label":"源端业务系统","x":817,"y":-166,"width":"200","height":"200","color":"202,56,0"},{"id":"1001","label":"研究","x":1007,"y":-477,"width":120,"height":120,"color":"202,56,0"},{"id":"1002","label":"安监","x":1190,"y":-9,"width":120,"height":120,"color":"202,56,0"},{"id":"1003","label":"法律","x":1173,"y":-376,"width":120,"height":120,"color":"202,56,0"},{"id":"1004","label":"科技","x":560,"y":-270,"width":120,"height":120,"color":"202,56,0"},{"id":"1005","label":"办公","x":789,"y":104,"width":120,"height":120,"color":"202,56,0"},{"id":"1006","label":"物资","x":564,"y":-35,"width":120,"height":120,"color":"202,56,0"},{"id":"1007","label":"设备","x":1022,"y":100,"width":120,"height":120,"color":"202,56,0"},{"id":"1008","label":"审计","x":1503,"y":-247,"width":120,"height":120,"color":"124,159,243"},{"id":"1009","label":"基建","x":791,"y":-434,"width":120,"height":120,"color":"202,56,0"},{"id":"1010","label":"后勤","x":1116,"y":-192,"width":120,"height":120,"color":"202,56,0"},{"id":"10081","label":"数字化审计","x":1700,"y":14,"width":120,"height":120,"color":"124,159,243"},{"id":"10082","label":"审计系统","x":2019,"y":-369,"width":"120","height":"120","color":"124,159,243"},{"id":"100821","label":"首页","x":2213,"y":-23,"width":120,"height":120,"color":"124,159,243"},{"id":"100822","label":"项目作业","x":2085,"y":-780,"width":120,"height":120,"color":"124,159,243"},{"id":"100823","label":"原项目入口","x":2320,"y":-206,"width":120,"height":120,"color":"124,159,243"},{"id":"100824","label":"计划管理","x":2221,"y":-591,"width":120,"height":120,"color":"124,159,243"},{"id":"100825","label":"技能知识","x":2022,"y":-83,"width":120,"height":120,"color":"124,159,243"},{"id":"100826","label":"日常管理","x":2346,"y":-419,"width":120,"height":120,"color":"124,159,243"},{"id":"100827","label":"资源绩效","x":1901,"y":-581,"width":120,"height":120,"color":"124,159,243"},{"id":"1008221","label":"数据表","x":2125,"y":-1072,"width":120,"height":120,"color":"124,159,243"},{"id":"200","label":"中台贴源层","x":-1030,"y":126,"width":"200","height":"200","color":"121,93,240"},{"id":"2001","label":"数字化审计","x":-1313,"y":158,"width":120,"height":120,"color":"121,93,240"},{"id":"2002","label":"电力交易","x":-1043,"y":493,"width":120,"height":120,"color":"121,93,240"},{"id":"2003","label":"国际业务","x":-1498,"y":344,"width":120,"height":120,"color":"121,93,240"},{"id":"2004","label":"综合管理","x":-856,"y":-92,"width":120,"height":120,"color":"121,93,240"},{"id":"2005","label":"信息通信","x":-1310,"y":708,"width":120,"height":120,"color":"121,93,240"},{"id":"2006","label":"产业业务","x":-1537,"y":7,"width":120,"height":120,"color":"121,93,240"},{"id":"2007","label":"数字档案馆","x":-703,"y":246,"width":120,"height":120,"color":"121,93,240"},{"id":"2008","label":"规划计划","x":-1373,"y":-250,"width":120,"height":120,"color":"121,93,240"},{"id":"2009","label":"科技管理","x":-1107,"y":-118,"width":120,"height":120,"color":"121,93,240"},{"id":"20021","label":"电力交易","x":-1057,"y":794,"width":120,"height":120,"color":"121,93,240"},{"id":"20031","label":"国际业务管理","x":-1825,"y":360,"width":120,"height":120,"color":"121,93,240"},{"id":"20032","label":"国际合作管理","x":-1742,"y":556,"width":120,"height":120,"color":"121,93,240"},{"id":"20051","label":"主数据平台","x":-1471,"y":1049,"width":120,"height":120,"color":"121,93,240"},{"id":"20052","label":"信息通信业务管理","x":-1274,"y":1079,"width":120,"height":120,"color":"121,93,240"},{"id":"20053","label":"企业架构管理","x":-1596,"y":880,"width":120,"height":120,"color":"121,93,240"},{"id":"20061","label":"集体业务管控","x":-1877,"y":29,"width":120,"height":120,"color":"121,93,240"},{"id":"20062","label":"产业集约管控","x":-1840,"y":-178,"width":120,"height":120,"color":"121,93,240"},{"id":"20081","label":"新一代电网发展","x":-1513,"y":-529,"width":120,"height":120,"color":"121,93,240"},{"id":"20082","label":"规划计划系统","x":-1692,"y":-435,"width":120,"height":120,"color":"121,93,240"},{"id":"300","label":"中台共享层","x":-70,"y":-1164,"width":"200","height":"200","color":"230,107,183"},{"id":"3001","label":"综合域","x":306,"y":-1849,"width":120,"height":120,"color":"152,66,193"},{"id":"3002","label":"市场域","x":-290,"y":-814,"width":120,"height":120,"color":"230,107,183"},{"id":"3003","label":"项目域","x":-404,"y":-1705,"width":120,"height":120,"color":"230,107,183"},{"id":"3004","label":"人员域","x":283,"y":-999,"width":120,"height":120,"color":"70,151,2"},{"id":"3005","label":"物资域","x":-891,"y":-1223,"width":120,"height":120,"color":"41,156,77"},{"id":"3006","label":"客户域","x":868,"y":-1369,"width":120,"height":120,"color":"180,194,247"},{"id":"30011","label":"信息通信","x":542,"y":-1749,"width":120,"height":120,"color":"152,66,193"},{"id":"30012","label":"规划管理","x":85,"y":-2060,"width":120,"height":120,"color":"152,66,193"},{"id":"30013","label":"审计管理","x":121,"y":-1742,"width":120,"height":120,"color":"152,66,193"},{"id":"30014","label":"外部数据","x":677,"y":-1960,"width":120,"height":120,"color":"152,66,193"},{"id":"30015","label":"党建管理","x":630,"y":-2160,"width":120,"height":120,"color":"152,66,193"},{"id":"30016","label":"电网GIS","x":191,"y":-2228,"width":120,"height":120,"color":"152,66,193"},{"id":"30017","label":"法律法规","x":401,"y":-2263,"width":120,"height":120,"color":"152,66,193"},{"id":"30018","label":"协同办公","x":443,"y":-2071,"width":120,"height":120,"color":"152,66,193"},{"id":"30021","label":"市场管理","x":-258,"y":-545,"width":120,"height":120,"color":"230,107,183"},{"id":"30022","label":"市场公共","x":-514,"y":-856,"width":120,"height":120,"color":"230,107,183"},{"id":"30023","label":"市场运营","x":-501,"y":-597,"width":120,"height":120,"color":"230,107,183"},{"id":"30031","label":"项目计划","x":-750,"y":-1922,"width":120,"height":120,"color":"230,107,183"},{"id":"30032","label":"项目预算","x":-667,"y":-1733,"width":120,"height":120,"color":"230,107,183"},{"id":"30033","label":"项目公共包","x":-414,"y":-1493,"width":120,"height":120,"color":"230,107,183"},{"id":"30034","label":"项目执行","x":-292,"y":-1937,"width":120,"height":120,"color":"230,107,183"},{"id":"30035","label":"项目规划","x":-420,"y":-2099,"width":120,"height":120,"color":"230,107,183"},{"id":"30036","label":"项目评价","x":-601,"y":-2038,"width":120,"height":120,"color":"230,107,183"},{"id":"30041","label":"组织管理","x":573,"y":-918,"width":120,"height":120,"color":"70,151,2"},{"id":"30042","label":"绩效管理","x":115,"y":-798,"width":120,"height":120,"color":"70,151,2"},{"id":"30043","label":"培训开发","x":351,"y":-739,"width":120,"height":120,"color":"70,151,2"},{"id":"30044","label":"福利管理","x":512,"y":-1160,"width":120,"height":120,"color":"70,151,2"},{"id":"30045","label":"人员管理","x":244,"y":-1254,"width":120,"height":120,"color":"70,151,2"},{"id":"30051","label":"采购寻源","x":-1275,"y":-1433,"width":120,"height":120,"color":"41,156,77"},{"id":"30052","label":"质量监督","x":-1081,"y":-943,"width":120,"height":120,"color":"41,156,77"},{"id":"30053","label":"采购合同","x":-1140,"y":-1261,"width":120,"height":120,"color":"41,156,77"},{"id":"30054","label":"采购计划","x":-866,"y":-978,"width":120,"height":120,"color":"41,156,77"},{"id":"30055","label":"物力资源","x":-1120,"y":-1555,"width":120,"height":120,"color":"41,156,77"},{"id":"30056","label":"仓储","x":-927,"y":-1472,"width":120,"height":120,"color":"41,156,77"},{"id":"30057","label":"配送","x":-1345,"y":-1231,"width":120,"height":120,"color":"41,156,77"},{"id":"30058","label":"供应商管理","x":-1253,"y":-1049,"width":120,"height":120,"color":"41,156,77"},{"id":"30061","label":"客户服务","x":1134,"y":-1437,"width":120,"height":120,"color":"180,194,247"},{"id":"30062","label":"能效服务","x":1336,"y":-1377,"width":120,"height":120,"color":"180,194,247"},{"id":"30063","label":"付费","x":1291,"y":-1581,"width":120,"height":120,"color":"180,194,247"},{"id":"30064","label":"客户公共","x":1048,"y":-1133,"width":120,"height":120,"color":"180,194,247"},{"id":"30065","label":"电子商城","x":1243,"y":-1198,"width":120,"height":120,"color":"180,194,247"},{"id":"30066","label":"客户","x":962,"y":-1654,"width":120,"height":120,"color":"180,194,247"},{"id":"30067","label":"综合能源服务","x":1146,"y":-1717,"width":120,"height":120,"color":"180,194,247"},{"id":"400","label":"中台分析层","x":-13,"y":914,"width":"200","height":"200","color":"198,83,45"},{"id":"4001","label":"实物ID","x":963,"y":1265,"width":120,"height":120,"color":"223,184,77"},{"id":"4002","label":"抽水蓄能","x":170,"y":1139,"width":120,"height":120,"color":"198,83,45"},{"id":"4003","label":"电子看经济","x":-106,"y":1434,"width":120,"height":120,"color":"198,83,45"},{"id":"4004","label":"新能源云","x":-188,"y":530,"width":120,"height":120,"color":"198,83,45"},{"id":"4005","label":"国资在线监督","x":236,"y":659,"width":120,"height":120,"color":"198,83,45"},{"id":"4006","label":"民企清欠","x":-339,"y":683,"width":120,"height":120,"color":"198,83,45"},{"id":"4007","label":"智慧供应链","x":76,"y":1353,"width":120,"height":120,"color":"198,83,45"},{"id":"4008","label":"公共数据层","x":-283,"y":930,"width":120,"height":120,"color":"198,83,45"},{"id":"4009","label":"技术学院培训","x":-280,"y":1163,"width":120,"height":120,"color":"198,83,45"},{"id":"4010","label":"智能问数","x":-67,"y":675,"width":120,"height":120,"color":"198,83,45"},{"id":"4011","label":"设备标签库","x":-483,"y":1070,"width":120,"height":120,"color":"198,83,45"},{"id":"4012","label":"分析层综合域","x":71,"y":524,"width":120,"height":120,"color":"198,83,45"},{"id":"4013","label":"电力消费指数","x":-81,"y":1221,"width":120,"height":120,"color":"198,83,45"},{"id":"4014","label":"同期线损","x":-435,"y":1265,"width":120,"height":120,"color":"198,83,45"},{"id":"4015","label":"电力物流平台","x":-282,"y":1384,"width":120,"height":120,"color":"198,83,45"},{"id":"4016","label":"营销2.0","x":258,"y":875,"width":120,"height":120,"color":"198,83,45"},{"id":"4017","label":"分析层报表中心","x":-463,"y":858,"width":120,"height":120,"color":"198,83,45"},{"id":"40011","label":"试验信息指标表","x":1121,"y":826,"width":120,"height":120,"color":"223,184,77"},{"id":"40012","label":"实物ID公共代码表","x":830,"y":1521,"width":120,"height":120,"color":"223,184,77"},{"id":"40013","label":"物资采购信息指标表","x":1291,"y":1131,"width":120,"height":120,"color":"223,184,77"},{"id":"40014","label":"项目金额模型表","x":1075,"y":1524,"width":120,"height":120,"color":"223,184,77"},{"id":"40015","label":"巡视信息指标表","x":1448,"y":1013,"width":120,"height":120,"color":"223,184,77"},{"id":"40016","label":"抽检问题","x":1305,"y":894,"width":120,"height":120,"color":"223,184,77"},{"id":"40017","label":"指标公共编码表","x":614,"y":1446,"width":120,"height":120,"color":"223,184,77"},{"id":"40018","label":"本年增量赋码模型表","x":769,"y":1025,"width":120,"height":120,"color":"223,184,77"},{"id":"40019","label":"首页指标表","x":643,"y":1637,"width":120,"height":120,"color":"223,184,77"},{"id":"40020","label":"实物ID公共代码表","x":681,"y":1241,"width":120,"height":120,"color":"223,184,77"},{"id":"40021","label":"增量设备编码指标表","x":1461,"y":1381,"width":120,"height":120,"color":"223,184,77"},{"id":"40022","label":"工程建设信息指标","x":910,"y":870,"width":120,"height":120,"color":"223,184,77"},{"id":"40023","label":"新能源云","x":812,"y":1730,"width":120,"height":120,"color":"223,184,77"},{"id":"40024","label":"重点企业污染防治","x":1350,"y":1545,"width":120,"height":120,"color":"223,184,77"},{"id":"40025","label":"环保监测","x":1259,"y":1349,"width":120,"height":120,"color":"223,184,77"},{"id":"40026","label":"运营动态","x":1202,"y":1677,"width":120,"height":120,"color":"223,184,77"},{"id":"40027","label":"采购申请","x":1490,"y":1199,"width":120,"height":120,"color":"223,184,77"},{"id":"40028","label":"存量设备信息溯源指标表","x":1090,"y":1024,"width":120,"height":120,"color":"223,184,77"},{"id":"40029","label":"试验公共代码表","x":1001,"y":1729,"width":120,"height":120,"color":"223,184,77"}],"links":[{"source":"10","target":"100","color":"230,107,183"},{"source":"10","target":"200","color":"230,107,183"},{"source":"10","target":"300","color":"230,107,183"},{"source":"10","target":"400","color":"230,107,183"},{"source":"100","target":"1001","color":"202,56,0"},{"source":"100","target":"1002","color":"202,56,0"},{"source":"100","target":"1003","color":"202,56,0"},{"source":"100","target":"1004","color":"202,56,0"},{"source":"100","target":"1005","color":"202,56,0"},{"source":"100","target":"1006","color":"202,56,0"},{"source":"100","target":"1007","color":"202,56,0"},{"source":"100","target":"1008","color":"202,56,0"},{"source":"100","target":"1009","color":"202,56,0"},{"source":"100","target":"1010","color":"202,56,0"},{"source":"1008","target":"10081","color":"124,159,243"},{"source":"1008","target":"10082","color":"124,159,243"},{"source":"10082","target":"100821","color":"124,159,243"},{"source":"10082","target":"100822","color":"124,159,243"},{"source":"10082","target":"100823","color":"124,159,243"},{"source":"10082","target":"100824","color":"124,159,243"},{"source":"10082","target":"100825","color":"124,159,243"},{"source":"10082","target":"100826","color":"124,159,243"},{"source":"10082","target":"100827","color":"124,159,243"},{"source":"100822","target":"1008221","color":"124,159,243"},{"source":"200","target":"2001","color":"121,93,240"},{"source":"200","target":"2002","color":"121,93,240"},{"source":"200","target":"2003","color":"121,93,240"},{"source":"200","target":"2004","color":"121,93,240"},{"source":"200","target":"2005","color":"121,93,240"},{"source":"200","target":"2006","color":"121,93,240"},{"source":"200","target":"2007","color":"121,93,240"},{"source":"200","target":"2008","color":"121,93,240"},{"source":"200","target":"2009","color":"121,93,240"},{"source":"2002","target":"20021","color":"121,93,240"},{"source":"2003","target":"20031","color":"121,93,240"},{"source":"2003","target":"20032","color":"121,93,240"},{"source":"2005","target":"20051","color":"121,93,240"},{"source":"2005","target":"20052","color":"121,93,240"},{"source":"2005","target":"20053","color":"121,93,240"},{"source":"2006","target":"20061","color":"121,93,240"},{"source":"2006","target":"20062","color":"121,93,240"},{"source":"2008","target":"20081","color":"121,93,240"},{"source":"2008","target":"20082","color":"121,93,240"},{"source":"300","target":"3001","color":"230,107,183"},{"source":"300","target":"3002","color":"230,107,183"},{"source":"300","target":"3003","color":"230,107,183"},{"source":"300","target":"3004","color":"230,107,183"},{"source":"300","target":"3005","color":"230,107,183"},{"source":"300","target":"3006","color":"230,107,183"},{"source":"3001","target":"30011","color":"152,66,193"},{"source":"3001","target":"30012","color":"152,66,193"},{"source":"3001","target":"30013","color":"152,66,193"},{"source":"3001","target":"30014","color":"152,66,193"},{"source":"3001","target":"30015","color":"152,66,193"},{"source":"3001","target":"30016","color":"152,66,193"},{"source":"3001","target":"30017","color":"152,66,193"},{"source":"3001","target":"30018","color":"152,66,193"},{"source":"3002","target":"30021","color":"230,107,183"},{"source":"3002","target":"30022","color":"230,107,183"},{"source":"3002","target":"30023","color":"230,107,183"},{"source":"3003","target":"30031","color":"230,107,183"},{"source":"3003","target":"30032","color":"230,107,183"},{"source":"3003","target":"30033","color":"230,107,183"},{"source":"3003","target":"30034","color":"230,107,183"},{"source":"3003","target":"30035","color":"230,107,183"},{"source":"3003","target":"30036","color":"230,107,183"},{"source":"3004","target":"30041","color":"70,151,2"},{"source":"3004","target":"30042","color":"70,151,2"},{"source":"3004","target":"30043","color":"70,151,2"},{"source":"3004","target":"30044","color":"70,151,2"},{"source":"3004","target":"30045","color":"70,151,2"},{"source":"3005","target":"30051","color":"41,156,77"},{"source":"3005","target":"30052","color":"41,156,77"},{"source":"3005","target":"30053","color":"41,156,77"},{"source":"3005","target":"30054","color":"41,156,77"},{"source":"3005","target":"30055","color":"41,156,77"},{"source":"3005","target":"30056","color":"41,156,77"},{"source":"3005","target":"30057","color":"41,156,77"},{"source":"3005","target":"30058","color":"41,156,77"},{"source":"3006","target":"30061","color":"180,194,247"},{"source":"3006","target":"30062","color":"180,194,247"},{"source":"3006","target":"30063","color":"180,194,247"},{"source":"3006","target":"30064","color":"180,194,247"},{"source":"3006","target":"30065","color":"180,194,247"},{"source":"3006","target":"30066","color":"180,194,247"},{"source":"3006","target":"30067","color":"180,194,247"},{"source":"400","target":"4001","color":"198,83,45"},{"source":"400","target":"4002","color":"198,83,45"},{"source":"400","target":"4003","color":"198,83,45"},{"source":"400","target":"4004","color":"198,83,45"},{"source":"400","target":"4005","color":"198,83,45"},{"source":"400","target":"4006","color":"198,83,45"},{"source":"400","target":"4007","color":"198,83,45"},{"source":"400","target":"4008","color":"198,83,45"},{"source":"400","target":"4009","color":"198,83,45"},{"source":"400","target":"4010","color":"198,83,45"},{"source":"400","target":"4011","color":"198,83,45"},{"source":"400","target":"4012","color":"198,83,45"},{"source":"400","target":"4013","color":"198,83,45"},{"source":"400","target":"4014","color":"198,83,45"},{"source":"400","target":"4015","color":"198,83,45"},{"source":"400","target":"4016","color":"198,83,45"},{"source":"400","target":"4017","color":"198,83,45"},{"source":"4001","target":"40011","color":"223,184,77"},{"source":"4001","target":"40012","color":"223,184,77"},{"source":"4001","target":"40013","color":"223,184,77"},{"source":"4001","target":"40014","color":"223,184,77"},{"source":"4001","target":"40015","color":"223,184,77"},{"source":"4001","target":"40016","color":"223,184,77"},{"source":"4001","target":"40017","color":"223,184,77"},{"source":"4001","target":"40018","color":"223,184,77"},{"source":"4001","target":"40019","color":"223,184,77"},{"source":"4001","target":"40020","color":"223,184,77"},{"source":"4001","target":"40021","color":"223,184,77"},{"source":"4001","target":"40022","color":"223,184,77"},{"source":"4001","target":"40023","color":"223,184,77"},{"source":"4001","target":"40024","color":"223,184,77"},{"source":"4001","target":"40025","color":"223,184,77"},{"source":"4001","target":"40026","color":"223,184,77"},{"source":"4001","target":"40027","color":"223,184,77"},{"source":"4001","target":"40028","color":"223,184,77"},{"source":"4001","target":"40029","color":"223,184,77"}]};

	visgraph.drawData(demoData);
	visgraph.setZoom('auto');
	
	
	
	//下拉联想选择
	var labelDatas = demoData.nodes.map((node)=>{
		return {value:node.label,id:node.id};
	});
	initAutoSelect(labelDatas);
	
	visgraph.nodes.forEach((node)=>{
		//node.wrapText = true;
		if(node.id == 10){
			node.width = node.height = 300;
			node.font='bold 60px KaiTi';
			node.wrapText = true;
			node.drawNode=drawSpacialNode;
			
		}else if(node.id < 1000){
			node.width = node.height =200;
			node.font='bold 40px KaiTi';
			//node.fontColor='30,30,30';
			node.wrapText = true;
			node.drawNode=drawSpacialNode;
		}else if(node.id>1000 && node.id<10000){
			//node.setImage('img/icon/home.png');
			node.width = node.height =120;
		}else{
			//node.setImage('img/icon/table.png');
			node.width = node.height = 80;
		}	
	});
	
	visgraph.links.forEach((link)=>{
		link.lineWidth = 16;
		link.lineType='arrowline';
		link.colorType='both';
		//link.colorType='defined';
		//link.strokeColor='100,200,100';
		
		if(link.source.id == 10){
			link.lineWidth=40;
		}
	});
	
	visgraph.refresh();
	
	//查找节点
	function findNode(node){
		visgraph.scene.addToSelected(node);
		visgraph.focusTargetEle(node);
		//visgraph.moveNodeToCenter(node,800);
	}
	
	$('#searchEventBtn').click(function(){
		var nodeName = $.trim($('#nodename').val());
		var node = visgraph.findNodeByAttr('label',nodeName);
		if(node){
			findNode(node);
		}
	});
	
	function initAutoSelect(data){
		$('#nodename').autocomplete({
			lookup: data,
			minChars: 1,
			onSelect: function (item) {
				var node = visgraph.findNodeByAttr('id',item.id);
				if(node){
					findNode(node);
				}
			},
			showNoSuggestionNotice: true,
			noSuggestionNotice: '暂无结果',
		});
	}
	
	//画特殊节点
	function drawSpacialNode(ctx){
		var radius = this.radius;
		this.animate = this.animate>100?20:this.animate;
		ctx.save();
		ctx.beginPath();
		if (this.selected) {
			ctx.shadowBlur = this.radius,
			ctx.shadowColor = "rgba(20,250,20," +this.alpha+")",
			ctx.shadowOffsetX = 0,
			ctx.shadowOffsetY = 0;
		}
		ctx.arc(0, 0, radius, 0, 2*Math.PI);
		ctx.fillStyle='rgba('+this.fillColor+','+this.alpha+')';
		ctx.fill();
		ctx.closePath();
		ctx.restore();
		
		ctx.save();
		ctx.beginPath();
		ctx.arc(0,0,radius+20,0,2*Math.PI);
		ctx.lineWidth = 10;
		//ctx.strokeStyle = 'rgba(20,250,20)';
		ctx.strokeStyle = 'rgba('+this.fillColor+','+this.alpha+')';
		ctx.setLineDash([10,6]);
		ctx.lineDashOffset=(this.animate+=5);
		ctx.stroke();
		ctx.closePath();
		ctx.restore();
		
		ctx.save();
		ctx.beginPath();
		ctx.arc(0,0,radius-8,0,2*Math.PI);
		ctx.lineWidth = 8;
		ctx.strokeStyle = 'rgba(20,250,20,'+this.alpha+')';
		ctx.setLineDash([4,6]);
		ctx.lineDashOffset=(this.animate++);
		ctx.stroke();
		ctx.closePath();
		ctx.restore();
		
		this.showlabel==true?this.paintText(ctx):'';
	};
	
	
	
});