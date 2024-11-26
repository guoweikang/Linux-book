$(function(){
	let visgraph = null;
	//可视化默认配置
	const config = {
		node:{ //节点的默认配置
			label:{ //标签配置
				show:true, //是否显示
				color:'250,250,250',//字体颜色
				font:'normal 30px KaiTi',//字体大小及类型 LiSu Arial
				textPosition:'Middle_Right',//文字位置 Top_Center,Bottom_Center,Middle_Right,Middle_Center
				//borderWidth:1,
				//borderColor:'100,250,150',
				//textOffsetY:4,
				//backgroud:'250,250,250'
			},
			shape:'circle',//自定义节点时默认都是在rect包裹内部绘制
			//width:30,
			//height:30,
			size:60,
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
				//findNode(node);
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
			lineType: 'hbezier', //连线类型,curver,vlink,hlink,vbezier,hbezier
			colorType: 'defined', //连线颜色类型 source:继承source颜色,target:继承target颜色 both:用双边颜色，d:自定义
			color: '100,100,200', //连线颜色
			alpha: 1, // 连线透明度
			lineWidth: 3, //连线宽度
			lineDash: [0], //虚线间隔样式如：[5,8]
			showArrow: true, //显示连线箭头
			selected: { //选中时的样式设置
				color: '20,250,50', //选中时的颜色
				alpha: 1,
				lineWidth: 4,
				showShadow: false, //是否展示阴影
				shadowColor: '50,250,50', //选中连线时的阴影颜色
			}
		},
		highLightNeiber:false,
		wheelZoom:0.8
	};
	
	//1、初始化图对象
	visgraph = new VisGraph(document.getElementById('graph-panel'),config);
	visgraph.setShowDetailScale(0.1);//显示详细
	
	// 叶子节点 大小： 19  依次增加5
	var demoData =  {
		"nodes":[
			{
				"id":1,
				"label":"前置知识点",
				"type": "fake",
				"size":39,
				"scale":"1.8",
				"color":"rgb(120,233,133)"
			},
			{
				"id":2,
				"label":"版本介绍",
				"type": "content",
				"size":19,
				"color":"rgb(120,233,133)",
				"properties": "https://linux-book.readthedocs.io/en/latest/intro/version/"
			},
			
			{
				"id":3,
				"label":"编码规范",
				"type": "content",
				"size":19,
				"color":"rgb(120,233,133)",
				"properties": "https://linux-book.readthedocs.io/en/latest/intro/code/"
			},
		],
		"links":[
			{
				"source":1,
				"target":2
			},
			{
				"source":1,
				"target":3
			}
		]
	};
	
	visgraph.drawData(demoData);
	
	runTreeLayout(visgraph.getVisibleData());
	//获取图可视化元素中所有的节点 显示标签并且绑定双击事件
	var nodes = visgraph.nodes;
	nodes.map(function(node){
		if(node.type == 'content'){
			node.showShadow = true;	
			node.dbclick(function(event){
				 window.open(node.properties, '_blank'); // 在新标签页中打开链接
			});
		}
	});
	visgraph.setZoom('auto');
		
	//下拉联想选择
	var labelDatas = demoData.nodes.map((node)=>{
		if(isNaN(node.id)){
			return {value:node.id,id:node.id};
		}
		return {value:node.label,id:node.id};
	});
	initAutoSelect(labelDatas);
    visgraph.refresh();//修改样式后刷新视图
	
	
	function findNode(node){
		visgraph.scene.addToSelected(node);
		visgraph.focusTargetEle(node);
		//visgraph.moveNodeToCenter(node,800);
	}
	
	//计算节点坐标
	function runTreeLayout(graphData,direction,distX,distY){
		var layout=new LayoutFactory(graphData).createLayout("tree");
		layout.resetConfig({
			distX:distX||60,
			distY:distY||600,
			direction:direction||'LR'
		});
		layout.intSteps=0;
		layout.boolTransition=false;
		layout.runLayout();
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
});