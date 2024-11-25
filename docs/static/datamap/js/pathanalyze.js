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
	
	//示例数据
	//var demoData={"nodes":[{"id":"10000","label":"国家电网有限公司","x":1364,"y":-300},{"id":"10","label":"产融协同平台","x":1133,"y":-39},{"id":"100","label":"XSCYL","x":763,"y":367},{"id":"101","label":"ACCOUNT_CHANGE_LETTER","x":426,"y":34},{"id":"102","label":"ACCOUNT_CHANGE_LETTER_ITEM","x":1031,"y":495},{"id":"103","label":"ACCOUNT_CHANGE_RECORD","x":550,"y":237},{"id":"104","label":"ACCOUNT_CHANGE_STATE","x":1245,"y":435},{"id":"105","label":"ACCOUNT_CHANGE_TEMPLATE","x":543,"y":463},{"id":"106","label":"COLUMN_RULE","x":888,"y":-11},{"id":"107","label":"CONFIRMATION_LETTER","x":1084,"y":62},{"id":"108","label":"CONFIRMATION_LETTER_ITEM","x":929,"y":500},{"id":"109","label":"CONFIRMATION_RECORD","x":505,"y":-39},{"id":"110","label":"CONFIRMATION_RECORD_DETAIL","x":1063,"y":726},{"id":"111","label":"CONFIRMATION_STATE","x":598,"y":130},{"id":"112","label":"CONFIRMATION_TEMPLATE","x":1146,"y":351},{"id":"113","label":"DATA_BELONG_ORG","x":1035,"y":607},{"id":"114","label":"DATA_INS_AUTH","x":1093,"y":163},{"id":"115","label":"DATA_PRIVILEGE","x":817,"y":568},{"id":"116","label":"DATA_SOURCE","x":1029,"y":270},{"id":"117","label":"DATA_SOURCE_DETAIL","x":615,"y":21},{"id":"118","label":"DATA_UPDATE_DETAIL","x":592,"y":-90},{"id":"119","label":"DATA_UPDATE_LOG","x":521,"y":68},{"id":"120","label":"FINANCING_DEMAND","x":1183,"y":129},{"id":"121","label":"FINANCING_STATE","x":1052,"y":391},{"id":"122","label":"INSURANCE_DEMAND","x":940,"y":771},{"id":"123","label":"INSURANCE_INFO","x":1219,"y":550},{"id":"124","label":"INS_ACCOUNT_CHANGE_TEMPLATE","x":1132,"y":252},{"id":"125","label":"INS_CONFIRMATION_TEMPLATE","x":796,"y":11},{"id":"126","label":"INVESTMENT_DEMAND","x":1227,"y":230},{"id":"127","label":"INVESTMENT_INFO","x":954,"y":351},{"id":"128","label":"LOAN_INFO","x":1145,"y":655},{"id":"129","label":"LOSS_OCCURRED_INFO","x":994,"y":162},{"id":"130","label":"MONEY_DEMAND","x":472,"y":162},{"id":"131","label":"OAUTH_CLIENT_DETAILS","x":694,"y":590},{"id":"132","label":"P_PRODUCT_APPROVAL","x":984,"y":56},{"id":"133","label":"P_PRODUCT_FILING","x":699,"y":-40},{"id":"134","label":"P_PRODUCT_FINANCING","x":996,"y":-42},{"id":"135","label":"P_PRODUCT_INFO","x":468,"y":643},{"id":"136","label":"P_PRODUCT_INSURE","x":907,"y":-103},{"id":"137","label":"P_PRODUCT_MONEY","x":910,"y":610},{"id":"138","label":"P_SERVICE_CLASSES","x":703,"y":-128},{"id":"139","label":"P_SERVICE_TYPE","x":798,"y":152},{"id":"140","label":"REDEMPTION_INFO","x":373,"y":225},{"id":"141","label":"REPAYMENT_INFO","x":968,"y":686},{"id":"142","label":"REPLY_INFO","x":447,"y":284},{"id":"143","label":"SOURCE_ORG","x":715,"y":73},{"id":"144","label":"SYS_AREA","x":892,"y":95},{"id":"145","label":"SYS_AREA_INFO","x":564,"y":347},{"id":"146","label":"SYS_ATTACHMENT","x":904,"y":220},{"id":"147","label":"SYS_FINANCE_ORG_INFO","x":1245,"y":330},{"id":"148","label":"SYS_GW_BASIC_ORG","x":807,"y":-106},{"id":"149","label":"SYS_GW_ORG_INFO","x":672,"y":193},{"id":"150","label":"SYS_GW_SUPPLIER","x":457,"y":380},{"id":"151","label":"SYS_OFFICE","x":1145,"y":457},{"id":"152","label":"SYS_USER","x":1124,"y":558},{"id":"153","label":"T_LEGAL_PERSON","x":376,"y":121},{"id":"154","label":"T_ORG_INFO","x":845,"y":713},{"id":"155","label":"T_USER","x":631,"y":514},{"id":"156","label":"YIELD_INFO","x":758,"y":667},{"id":"BUSINESS_TYPE","label":"产品业务类型","x":260,"y":694},{"id":"CREATED_BY","label":"创建人员","x":535,"y":1053},{"id":"CREATED_DATE","label":"创建时间","x":173,"y":916},{"id":"DELETE_FLAG","label":"删除标识","x":337,"y":1038},{"id":"DELETE_TIME","label":"删除时间","x":245,"y":983},{"id":"DISABLED_STATE","label":"禁用状态","x":543,"y":948},{"id":"GIVE_SERVICE","label":"服务客群","x":186,"y":601},{"id":"ID","label":"唯一标识","x":419,"y":961},{"id":"INTRODUCE","label":"产品介绍","x":97,"y":648},{"id":"LAST_MODIFIED_BY","label":"修改人员","x":265,"y":538},{"id":"LAST_MODIFIED_DATE","label":"修改时间","x":590,"y":854},{"id":"NAME","label":"产品名称","x":110,"y":836},{"id":"ORG_CODE","label":"金融企业编码","x":332,"y":810},{"id":"PRO1","label":"产品文件名","x":671,"y":909},{"id":"PRO2","label":"产品状态","x":321,"y":917},{"id":"PRO3","label":"商品上下架审批人名称","x":232,"y":829},{"id":"PRO4","label":"下架文件名称","x":626,"y":1036},{"id":"PRODUCT_FEATURES","label":"产品特点多个的时候以@分割","x":102,"y":486},{"id":"PRODUCT_FILE","label":"产品文件","x":441,"y":1064},{"id":"PRODUCT_NO","label":"产品编码","x":452,"y":866},{"id":"PRODUCT_URL","label":"产品链接","x":61,"y":735},{"id":"P_DETAILS","label":"产品详情-富文本","x":169,"y":741},{"id":"P_STATE","label":"产品状态","x":215,"y":462},{"id":"TYPE","label":"产品业务大类","x":149,"y":400},{"id":"VERSION","label":"记录版本","x":715,"y":983},{"id":"WEIGHT","label":"权重","x":55,"y":567}],"links":[{"source":"10000","target":"10"},{"source":"10","target":"100"},{"source":"100","target":"101"},{"source":"100","target":"102"},{"source":"100","target":"103"},{"source":"100","target":"104"},{"source":"100","target":"105"},{"source":"100","target":"106"},{"source":"100","target":"107"},{"source":"100","target":"108"},{"source":"100","target":"109"},{"source":"100","target":"110"},{"source":"100","target":"111"},{"source":"100","target":"112"},{"source":"100","target":"113"},{"source":"100","target":"114"},{"source":"100","target":"115"},{"source":"100","target":"116"},{"source":"100","target":"117"},{"source":"100","target":"118"},{"source":"100","target":"119"},{"source":"100","target":"120"},{"source":"100","target":"121"},{"source":"100","target":"122"},{"source":"100","target":"123"},{"source":"100","target":"124"},{"source":"100","target":"125"},{"source":"100","target":"126"},{"source":"100","target":"127"},{"source":"100","target":"128"},{"source":"100","target":"129"},{"source":"100","target":"130"},{"source":"100","target":"131"},{"source":"100","target":"132"},{"source":"100","target":"133"},{"source":"100","target":"134"},{"source":"100","target":"135"},{"source":"100","target":"136"},{"source":"100","target":"137"},{"source":"100","target":"138"},{"source":"100","target":"139"},{"source":"100","target":"140"},{"source":"100","target":"141"},{"source":"100","target":"142"},{"source":"100","target":"143"},{"source":"100","target":"144"},{"source":"100","target":"145"},{"source":"100","target":"146"},{"source":"100","target":"147"},{"source":"100","target":"148"},{"source":"100","target":"149"},{"source":"100","target":"150"},{"source":"100","target":"151"},{"source":"100","target":"152"},{"source":"100","target":"153"},{"source":"100","target":"154"},{"source":"100","target":"155"},{"source":"100","target":"156"},{"source":"135","target":"BUSINESS_TYPE"},{"source":"135","target":"CREATED_BY"},{"source":"135","target":"CREATED_DATE"},{"source":"135","target":"DELETE_FLAG"},{"source":"135","target":"DELETE_TIME"},{"source":"135","target":"DISABLED_STATE"},{"source":"135","target":"GIVE_SERVICE"},{"source":"135","target":"ID"},{"source":"135","target":"INTRODUCE"},{"source":"135","target":"LAST_MODIFIED_BY"},{"source":"135","target":"LAST_MODIFIED_DATE"},{"source":"135","target":"NAME"},{"source":"135","target":"ORG_CODE"},{"source":"135","target":"PRO1"},{"source":"135","target":"PRO2"},{"source":"135","target":"PRO3"},{"source":"135","target":"PRO4"},{"source":"135","target":"PRODUCT_FEATURES"},{"source":"135","target":"PRODUCT_FILE"},{"source":"135","target":"PRODUCT_NO"},{"source":"135","target":"PRODUCT_URL"},{"source":"135","target":"P_DETAILS"},{"source":"135","target":"P_STATE"},{"source":"135","target":"TYPE"},{"source":"135","target":"VERSION"},{"source":"135","target":"WEIGHT"}]};
	
	var demoData={"nodes":[{"id":"10000","label":"国家电网有限公司","x":1163,"y":-240},{"id":"10","label":"产融协同平台","x":1172,"y":-52},{"id":"100","label":"XSCYL","x":1035,"y":152},{"id":"135","label":"P_PRODUCT_INFO","x":758,"y":345},{"id":"BUSINESS_TYPE","label":"产品业务类型","x":497,"y":189},{"id":"CREATED_BY","label":"创建人员","x":628,"y":488},{"id":"CREATED_DATE","label":"创建时间","x":908,"y":182},{"id":"DELETE_FLAG","label":"删除标识","x":1045,"y":431},{"id":"DELETE_TIME","label":"删除时间","x":449,"y":284},{"id":"DISABLED_STATE","label":"禁用状态","x":1041,"y":325},{"id":"GIVE_SERVICE","label":"服务客群","x":833,"y":640},{"id":"ID","label":"唯一标识","x":866,"y":87},{"id":"INTRODUCE","label":"产品介绍","x":939,"y":424},{"id":"LAST_MODIFIED_BY","label":"修改人员","x":731,"y":661},{"id":"LAST_MODIFIED_DATE","label":"修改时间","x":547,"y":574},{"id":"NAME","label":"产品名称","x":1005,"y":525},{"id":"ORG_CODE","label":"金融企业编码","x":766,"y":154},{"id":"PRO1","label":"产品文件名","x":633,"y":625},{"id":"PRO2","label":"产品状态","x":549,"y":405},{"id":"PRO3","label":"商品上下架审批人名称","x":480,"y":495},{"id":"PRO4","label":"下架文件名称","x":955,"y":280},{"id":"PRODUCT_FEATURES","label":"产品特点多个的时候以@分割","x":735,"y":553},{"id":"PRODUCT_FILE","label":"产品文件","x":567,"y":290},{"id":"PRODUCT_NO","label":"产品编码","x":639,"y":179},{"id":"PRODUCT_URL","label":"产品链接","x":655,"y":63},{"id":"P_DETAILS","label":"产品详情-富文本","x":933,"y":603},{"id":"P_STATE","label":"产品状态","x":858,"y":521},{"id":"TYPE","label":"产品业务大类","x":762,"y":45},{"id":"VERSION","label":"记录版本","x":557,"y":107},{"id":"WEIGHT","label":"权重","x":443,"y":386}],"links":[{"source":"10000","target":"10"},{"source":"10","target":"100"},{"source":"100","target":"135"},{"source":"135","target":"BUSINESS_TYPE"},{"source":"135","target":"CREATED_BY"},{"source":"135","target":"CREATED_DATE"},{"source":"135","target":"DELETE_FLAG"},{"source":"135","target":"DELETE_TIME"},{"source":"135","target":"DISABLED_STATE"},{"source":"135","target":"GIVE_SERVICE"},{"source":"135","target":"ID"},{"source":"135","target":"INTRODUCE"},{"source":"135","target":"LAST_MODIFIED_BY"},{"source":"135","target":"LAST_MODIFIED_DATE"},{"source":"135","target":"NAME"},{"source":"135","target":"ORG_CODE"},{"source":"135","target":"PRO1"},{"source":"135","target":"PRO2"},{"source":"135","target":"PRO3"},{"source":"135","target":"PRO4"},{"source":"135","target":"PRODUCT_FEATURES"},{"source":"135","target":"PRODUCT_FILE"},{"source":"135","target":"PRODUCT_NO"},{"source":"135","target":"PRODUCT_URL"},{"source":"135","target":"P_DETAILS"},{"source":"135","target":"P_STATE"},{"source":"135","target":"TYPE"},{"source":"135","target":"VERSION"},{"source":"135","target":"WEIGHT"}]};
	visgraph.drawData(demoData);
	
	runTreeLayout(visgraph.getVisibleData());
	visgraph.setZoom('auto');
		
	//下拉联想选择
	var labelDatas = demoData.nodes.map((node)=>{
		if(isNaN(node.id)){
			return {value:node.id,id:node.id};
		}
		return {value:node.label,id:node.id};
	});
	initAutoSelect(labelDatas);

	
	visgraph.links.forEach((link)=>{
		if(link.source.id == 10000 || link.source.id == 10){
			link.lineWidth = 10;
			link.lineDash=[5,15];
			//link.lineType='direct';
			link.strokeColor='100,200,100';
		}else if(link.source.id == 100){
			link.target.width=link.target.height=30;
			link.target.font='bold 20px Arial';
			link.target.textOffsetX = 5;
		}
	});
	
	visgraph.nodes.forEach((node)=>{
		if(node.id == 135){
			node.width=node.height=100;
			node.textPosition='Bottom_Center';
			node.font='bold 40px KaiTi';
			node.fillColor='255,250,120';
			node.outLinks.forEach((link)=>{
				link.lineType='hlink';
				//link.strokeColor=node.fillColor;
				link.strokeColor='100,200,200';
				link.target.fillColor='120,200,200';
				link.target.textOffsetX = 5;
				link.target.label = link.target.id+'('+link.target.label+')';
			});
			
			node.inLinks.forEach((link) =>{
				link.lineWidth = 10;
				link.lineDash=[5,15];
				//link.lineType='direct';
				link.strokeColor='100,200,100';
			});
		}
		else if(node.id == 10000 || node.id == 10){
			node.width=node.height=100;
			node.textPosition='Bottom_Center';
			node.font='bold 40px KaiTi';
			node.fillColor='200,100,100';
		}else if(node.id == 100){
			node.width=node.height=100;
			node.textPosition='Bottom_Center';
			node.font='bold 40px Arial';
			node.fillColor='200,200,100';
		}else if(node.id == 'NAME'){
			node.width=node.height=30;
			node.shape='circle';
			node.fillColor='50,250,20';
			node.fontColor='50,250,20';
			node.inLinks.forEach((link) =>{
				link.lineWidth = 8;
				//link.lineDash=[5,15];
				//link.lineType='direct';
				link.strokeColor='50,250,20';
			});
		}else{
			node.width=node.height=30;
			node.shape='rect';
		}
	});
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