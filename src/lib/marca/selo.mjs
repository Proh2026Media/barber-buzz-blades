/**
 * Barba & Cabelo — selo de iniciais
 * Logo provisória para barbearias que ainda não têm logo.
 *
 * Arquivo único, sem dependências. Módulo ES: roda no Node 14+ e no navegador.
 * Entra o nome da barbearia, sai um SVG só com contornos (não depende de fonte
 * instalada, não usa texto, imagem, máscara nem recorte).
 *
 *   import { gerarSelo } from './selo.mjs';
 *
 *   // barbearia parceira sem logo: símbolo B&C + iniciais
 *   gerarSelo({ nome: 'Barbearia Alfa Zeta', tipo: 'parceria' });
 *
 *   // cliente pagante sem logo: só as iniciais, na cor da barbearia
 *   gerarSelo({ nome: 'Barbearia Alfa Zeta', tipo: 'iniciais' });
 *
 * Regras, opções e exemplos: LEIAME.md, na mesma pasta.
 * Aprovado pelo dono da marca em 24/11/2026.
 */

/* <dados> gerados por src/selos.py a partir da Manrope 800 e de src/geometria.py — não editar à mão */
const CAP = 1440; // altura das maiúsculas, em unidades da fonte
// letra: [avanço, borda esquerda da tinta, borda direita da tinta, contorno]
const LETRAS = {
  "A": [1366,40,1326,"M40 0L480 -1440L886 -1440L1326 0L1046 0L654 -1270L706 -1270L320 0ZM304 -300L304 -554L1064 -554L1064 -300Z"],
  "B": [1274,140,1214,"M140 0L140 -1440L716 -1440Q870 -1440 965 -1378Q1060 -1317 1104 -1224Q1148 -1131 1148 -1036Q1148 -915 1094 -835Q1039 -755 944 -728L944 -778Q1079 -750 1146 -653Q1214 -556 1214 -436Q1214 -307 1166 -209Q1119 -111 1022 -56Q925 0 778 0ZM416 -256L750 -256Q805 -256 848 -280Q891 -303 916 -346Q940 -388 940 -446Q940 -497 919 -537Q898 -577 856 -600Q813 -624 750 -624L416 -624ZM416 -878L712 -878Q758 -878 794 -894Q830 -910 851 -944Q872 -977 872 -1030Q872 -1096 831 -1141Q790 -1186 712 -1186L416 -1186Z"],
  "C": [1492,60,1412,"M758 30Q542 30 386 -64Q229 -158 144 -327Q60 -496 60 -720Q60 -944 144 -1113Q229 -1282 386 -1376Q542 -1470 758 -1470Q1006 -1470 1174 -1347Q1343 -1224 1412 -1014L1138 -938Q1098 -1069 1003 -1142Q908 -1214 758 -1214Q621 -1214 530 -1153Q438 -1092 392 -981Q346 -870 346 -720Q346 -570 392 -459Q438 -348 530 -287Q621 -226 758 -226Q908 -226 1003 -299Q1098 -372 1138 -502L1412 -426Q1343 -216 1174 -93Q1006 30 758 30Z"],
  "D": [1420,140,1320,"M140 0L140 -1440L606 -1440Q623 -1440 676 -1439Q729 -1438 778 -1432Q952 -1411 1073 -1311Q1194 -1211 1257 -1057Q1320 -903 1320 -720Q1320 -537 1257 -383Q1194 -229 1073 -129Q952 -29 778 -8Q729 -2 676 -1Q623 0 606 0ZM416 -256L606 -256Q633 -256 679 -258Q725 -259 762 -266Q856 -285 916 -354Q975 -423 1004 -520Q1032 -617 1032 -720Q1032 -828 1002 -925Q973 -1022 913 -1089Q853 -1156 762 -1174Q725 -1182 679 -1183Q633 -1184 606 -1184L416 -1184Z"],
  "E": [1180,140,1080,"M140 0L140 -1440L1080 -1440L1080 -1186L412 -1186L412 -878L960 -878L960 -624L412 -624L412 -254L1080 -254L1080 0Z"],
  "F": [1060,140,1020,"M140 0L140 -1440L1020 -1440L1020 -1168L412 -1168L412 -856L900 -856L900 -584L412 -584L412 0Z"],
  "G": [1482,60,1422,"M740 30Q604 30 481 -18Q358 -67 264 -162Q169 -257 114 -397Q60 -537 60 -720Q60 -959 152 -1126Q243 -1294 398 -1382Q552 -1470 740 -1470Q1018 -1470 1177 -1341Q1336 -1212 1390 -976L1112 -936Q1073 -1062 984 -1138Q896 -1213 758 -1214Q621 -1216 530 -1155Q439 -1094 394 -982Q348 -870 348 -720Q348 -570 394 -460Q439 -350 530 -289Q621 -228 758 -226Q851 -224 926 -258Q1002 -292 1054 -365Q1106 -438 1128 -552L900 -552L900 -762L1418 -762Q1420 -749 1421 -716Q1422 -683 1422 -678Q1422 -471 1338 -311Q1254 -151 1101 -60Q948 30 740 30Z"],
  "H": [1468,140,1328,"M140 0L140 -1440L412 -1440L412 -848L1056 -848L1056 -1440L1328 -1440L1328 0L1056 0L1056 -594L412 -594L412 0Z"],
  "I": [592,160,432,"M160 0L160 -1440L432 -1440L432 0Z"],
  "J": [1026,0,866,"M442 30Q270 30 158 -58Q47 -146 0 -296L268 -360Q277 -305 326 -264Q375 -224 430 -224Q468 -224 512 -245Q555 -266 574 -312Q586 -341 588 -383Q590 -425 590 -480L590 -1440L866 -1440L866 -480Q866 -411 866 -360Q865 -309 856 -264Q846 -220 818 -172Q757 -66 659 -18Q561 30 442 30Z"],
  "K": [1330,140,1330,"M140 0L140 -1440L412 -1440L412 -776L960 -1440L1292 -1440L690 -730L1330 0L986 0L412 -656L412 0Z"],
  "L": [1082,160,1052,"M160 0L160 -1440L432 -1440L432 -254L1052 -254L1052 0Z"],
  "M": [1720,140,1580,"M140 0L140 -1440L384 -1440L860 -484L1336 -1440L1580 -1440L1580 0L1326 0L1326 -860L908 0L812 0L394 -860L394 0Z"],
  "N": [1458,140,1318,"M140 0L140 -1440L416 -1440L1042 -480L1042 -1440L1318 -1440L1318 0L1042 0L416 -960L416 0Z"],
  "O": [1516,60,1456,"M758 30Q542 30 386 -64Q229 -158 144 -327Q60 -496 60 -720Q60 -944 144 -1113Q229 -1282 386 -1376Q542 -1470 758 -1470Q974 -1470 1130 -1376Q1287 -1282 1372 -1113Q1456 -944 1456 -720Q1456 -496 1372 -327Q1287 -158 1130 -64Q974 30 758 30ZM758 -226Q895 -224 986 -285Q1077 -346 1122 -458Q1168 -570 1168 -720Q1168 -870 1122 -980Q1077 -1090 986 -1151Q895 -1212 758 -1214Q621 -1216 530 -1155Q439 -1094 394 -982Q348 -870 348 -720Q348 -570 394 -460Q439 -350 530 -289Q621 -228 758 -226Z"],
  "P": [1300,140,1240,"M140 0L140 -1440L748 -1440Q769 -1440 804 -1438Q840 -1437 868 -1432Q997 -1412 1080 -1347Q1162 -1282 1201 -1184Q1240 -1085 1240 -964Q1240 -843 1200 -744Q1161 -646 1078 -581Q996 -516 868 -496Q840 -492 804 -490Q768 -488 748 -488L412 -488L412 0ZM412 -742L736 -742Q757 -742 782 -744Q807 -746 828 -752Q883 -767 913 -802Q943 -838 954 -882Q966 -925 966 -964Q966 -1003 954 -1046Q943 -1090 913 -1126Q883 -1161 828 -1176Q807 -1182 782 -1184Q757 -1186 736 -1186L412 -1186Z"],
  "Q": [1516,60,1456,"M1266 30L846 -388L1014 -556L1432 -138ZM758 30Q542 30 386 -64Q229 -158 144 -327Q60 -496 60 -720Q60 -944 144 -1113Q229 -1282 386 -1376Q542 -1470 758 -1470Q974 -1470 1130 -1376Q1287 -1282 1372 -1113Q1456 -944 1456 -720Q1456 -496 1372 -327Q1287 -158 1130 -64Q974 30 758 30ZM758 -226Q895 -224 986 -285Q1077 -346 1122 -458Q1168 -570 1168 -720Q1168 -870 1122 -980Q1077 -1090 986 -1151Q895 -1212 758 -1214Q621 -1216 530 -1155Q439 -1094 394 -982Q348 -870 348 -720Q348 -570 394 -460Q439 -350 530 -289Q621 -228 758 -226Z"],
  "R": [1340,140,1260,"M140 0L140 -1440L748 -1440Q769 -1440 804 -1438Q840 -1437 868 -1432Q997 -1412 1080 -1347Q1162 -1282 1201 -1184Q1240 -1085 1240 -964Q1240 -783 1150 -654Q1060 -526 868 -496L748 -488L412 -488L412 0ZM952 0L668 -586L948 -640L1260 0ZM412 -742L736 -742Q757 -742 782 -744Q807 -746 828 -752Q883 -767 913 -802Q943 -838 954 -882Q966 -925 966 -964Q966 -1003 954 -1046Q943 -1090 913 -1126Q883 -1161 828 -1176Q807 -1182 782 -1184Q757 -1186 736 -1186L412 -1186Z"],
  "S": [1342,80,1262,"M684 30Q524 30 396 -26Q267 -83 184 -188Q102 -294 80 -440L364 -482Q394 -358 488 -291Q582 -224 702 -224Q769 -224 832 -245Q895 -266 936 -307Q976 -348 976 -408Q976 -430 970 -450Q963 -471 948 -489Q933 -507 906 -523Q878 -539 836 -552L462 -662Q420 -674 364 -696Q309 -718 257 -759Q205 -800 170 -868Q136 -935 136 -1038Q136 -1183 209 -1279Q282 -1375 404 -1422Q526 -1469 674 -1468Q823 -1466 940 -1417Q1057 -1368 1136 -1274Q1215 -1181 1250 -1046L956 -996Q940 -1066 897 -1114Q854 -1162 794 -1187Q735 -1212 670 -1214Q606 -1216 550 -1196Q493 -1177 458 -1140Q422 -1103 422 -1052Q422 -1005 451 -976Q480 -946 524 -928Q568 -910 614 -898L864 -830Q920 -815 988 -790Q1056 -766 1118 -722Q1181 -679 1222 -608Q1262 -537 1262 -428Q1262 -312 1214 -226Q1165 -139 1083 -82Q1001 -26 898 2Q794 30 684 30Z"],
  "T": [1220,20,1200,"M474 0L474 -1186L20 -1186L20 -1440L1200 -1440L1200 -1186L746 -1186L746 0Z"],
  "U": [1452,140,1312,"M726 30Q552 30 420 -40Q288 -111 214 -239Q140 -367 140 -540L140 -1438L416 -1440L416 -542Q416 -471 440 -413Q464 -355 506 -313Q549 -271 606 -248Q662 -226 726 -226Q792 -226 848 -249Q905 -272 947 -314Q989 -356 1012 -414Q1036 -472 1036 -542L1036 -1440L1312 -1440L1312 -540Q1312 -367 1238 -239Q1164 -111 1032 -40Q900 30 726 30Z"],
  "V": [1306,10,1296,"M450 0L10 -1440L290 -1440L650 -256L1016 -1440L1296 -1440L856 0Z"],
  "W": [1978,20,1958,"M442 0L20 -1440L306 -1440L576 -450L846 -1438L1132 -1440L1402 -450L1672 -1440L1958 -1440L1536 0L1268 0L989 -972L710 0Z"],
  "X": [1344,20,1324,"M20 0L504 -728L34 -1440L368 -1440L674 -960L976 -1440L1312 -1440L842 -728L1324 0L990 0L674 -496L356 0Z"],
  "Y": [1260,0,1260,"M492 0L492 -586L0 -1440L318 -1440L630 -898L942 -1440L1260 -1440L768 -586L768 0Z"],
  "Z": [1360,100,1260,"M100 0L100 -34L784 -1186L160 -1186L160 -1440L1260 -1440L1260 -1406L580 -256L1240 -256L1240 0Z"],
  "0": [1348,140,1208,"M674 30Q514 30 394 -37Q274 -104 207 -224Q140 -344 140 -504L140 -936Q140 -1096 207 -1216Q274 -1336 394 -1403Q514 -1470 674 -1470Q834 -1470 954 -1403Q1074 -1336 1141 -1216Q1208 -1096 1208 -936L1208 -504Q1208 -344 1141 -224Q1074 -104 954 -37Q834 30 674 30ZM674 -228Q746 -228 804 -262Q862 -296 896 -354Q930 -412 930 -484L930 -958Q930 -1030 896 -1088Q862 -1146 804 -1180Q746 -1214 674 -1214Q602 -1214 544 -1180Q486 -1146 452 -1088Q418 -1030 418 -958L418 -484Q418 -412 452 -354Q486 -296 544 -262Q602 -228 674 -228Z"],
  "1": [908,120,668,"M390 0L390 -1144L120 -978L120 -1278L390 -1440L668 -1440L668 0Z"],
  "2": [1208,100,1108,"M100 -2L100 -238L704 -774Q772 -834 800 -887Q828 -940 828 -986Q828 -1052 801 -1104Q774 -1155 725 -1184Q676 -1214 610 -1214Q541 -1214 488 -1182Q436 -1151 407 -1100Q378 -1048 380 -988L100 -988Q100 -1136 165 -1244Q230 -1352 346 -1411Q462 -1470 616 -1470Q757 -1470 868 -1408Q980 -1347 1044 -1237Q1108 -1127 1108 -982Q1108 -875 1078 -804Q1048 -734 989 -674Q930 -615 844 -540L454 -198L432 -258L1108 -258L1108 -2Z"],
  "3": [1182,80,1062,"M560 26Q452 26 354 -18Q256 -61 184 -140Q111 -219 80 -326L344 -396Q365 -317 426 -274Q488 -230 560 -230Q622 -230 674 -260Q725 -290 756 -341Q786 -392 786 -454Q786 -547 722 -614Q659 -680 560 -680Q530 -680 502 -672Q474 -663 448 -648L326 -862L784 -1242L804 -1184L136 -1184L136 -1440L1036 -1440L1036 -1184L680 -840L678 -916Q802 -897 888 -830Q973 -762 1018 -664Q1062 -565 1062 -454Q1062 -318 993 -210Q924 -101 810 -38Q696 26 560 26Z"],
  "4": [1230,100,1130,"M726 0L726 -224L100 -224L100 -478L554 -1440L866 -1440L412 -478L726 -478L726 -838L1002 -838L1002 -478L1130 -478L1130 -224L1002 -224L1002 0Z"],
  "5": [1178,100,1078,"M568 30Q459 30 364 -15Q268 -60 199 -140Q130 -220 100 -326L362 -396Q375 -345 408 -308Q442 -271 486 -250Q531 -230 578 -230Q640 -230 692 -260Q743 -290 774 -341Q804 -392 804 -454Q804 -516 774 -567Q743 -618 692 -648Q640 -678 578 -678Q502 -678 454 -652Q406 -627 382 -604L152 -674L196 -1440L982 -1440L982 -1186L346 -1186L442 -1276L412 -782L366 -838Q420 -882 489 -902Q558 -922 618 -922Q754 -922 858 -862Q961 -801 1020 -696Q1078 -590 1078 -454Q1078 -318 1007 -208Q936 -99 820 -34Q704 30 568 30Z"],
  "6": [1244,140,1144,"M642 30Q499 30 386 -37Q272 -104 206 -224Q140 -343 140 -500L140 -918Q140 -1088 206 -1212Q272 -1335 392 -1402Q512 -1468 674 -1468Q779 -1468 874 -1437Q969 -1406 1048 -1332L854 -1138Q818 -1174 771 -1194Q724 -1214 674 -1214Q596 -1214 538 -1178Q481 -1141 450 -1082Q418 -1024 418 -958L418 -744L372 -794Q434 -857 516 -890Q597 -924 684 -924Q820 -924 924 -863Q1027 -802 1086 -696Q1144 -590 1144 -454Q1144 -318 1075 -208Q1006 -99 892 -34Q778 30 642 30ZM642 -230Q704 -230 756 -260Q807 -290 838 -341Q868 -392 868 -454Q868 -516 838 -568Q808 -619 757 -650Q706 -680 644 -680Q582 -680 530 -650Q479 -619 448 -568Q418 -516 418 -454Q418 -394 448 -343Q478 -292 529 -261Q580 -230 642 -230Z"],
  "7": [1088,80,988,"M212 0L696 -1184L80 -1184L80 -1440L988 -1440L988 -1184L506 0Z"],
  "8": [1246,120,1126,"M622 30Q476 30 362 -30Q249 -89 184 -194Q120 -298 120 -432Q120 -546 172 -647Q223 -748 320 -812L314 -728Q241 -799 200 -878Q158 -957 158 -1056Q158 -1181 218 -1274Q277 -1367 382 -1418Q486 -1470 622 -1470Q758 -1470 862 -1418Q967 -1367 1026 -1274Q1086 -1181 1086 -1056Q1086 -957 1047 -878Q1008 -800 928 -726L928 -810Q1023 -750 1074 -648Q1126 -546 1126 -432Q1126 -298 1061 -194Q996 -89 882 -30Q768 30 622 30ZM622 -226Q718 -226 778 -278Q838 -330 838 -432Q838 -533 778 -586Q718 -640 622 -640Q526 -640 467 -586Q408 -533 408 -432Q408 -330 467 -278Q526 -226 622 -226ZM622 -898Q700 -898 749 -936Q798 -975 798 -1056Q798 -1137 749 -1176Q700 -1216 622 -1216Q544 -1216 495 -1176Q446 -1137 446 -1056Q446 -975 495 -936Q544 -898 622 -898Z"],
  "9": [1244,100,1104,"M602 -1468Q745 -1468 858 -1401Q972 -1334 1038 -1214Q1104 -1095 1104 -938L1104 -520Q1104 -350 1038 -226Q972 -103 852 -36Q732 30 570 30Q465 30 370 -2Q276 -33 196 -106L390 -300Q426 -264 474 -244Q521 -224 570 -224Q648 -224 706 -260Q763 -297 794 -356Q826 -414 826 -480L826 -694L872 -644Q811 -581 729 -548Q647 -514 560 -514Q424 -514 320 -575Q217 -636 158 -742Q100 -848 100 -984Q100 -1120 169 -1230Q238 -1339 352 -1404Q466 -1468 602 -1468ZM602 -1208Q540 -1208 488 -1178Q437 -1148 406 -1097Q376 -1046 376 -984Q376 -922 406 -870Q436 -819 487 -788Q538 -758 600 -758Q662 -758 714 -788Q765 -819 796 -870Q826 -922 826 -984Q826 -1044 796 -1095Q766 -1146 715 -1177Q664 -1208 602 -1208Z"]
};
// ajuste de espaço entre pares, da própria fonte
const KERNING = {"AA":60,"AC":-40,"AG":-40,"AO":-40,"AQ":-40,"AS":-40,"AT":-120,"AU":-40,"AV":-140,"AW":-140,"AY":-120,"A4":60,"BT":-40,"BV":-60,"BW":-60,"BX":-60,"BY":-60,"CA":-40,"CS":60,"CV":-40,"CW":-40,"CX":-60,"CY":-60,"C4":-40,"DA":-40,"DT":-40,"DV":-60,"DW":-60,"DX":-60,"DY":-60,"DZ":-50,"D4":-40,"EC":-50,"EG":-60,"EO":-60,"EQ":-60,"FA":-20,"FJ":-100,"F4":-20,"GA":-40,"GT":-40,"GV":-60,"GW":-60,"GX":-60,"GY":-60,"G4":-40,"IY":-80,"JA":-40,"J4":-40,"KC":-60,"KG":-80,"KO":-80,"KQ":-60,"KS":-60,"LG":-40,"LO":-40,"LQ":-40,"LT":-200,"LV":-160,"LW":-160,"LY":-200,"OA":-40,"OT":-40,"OV":-60,"OW":-60,"OX":-100,"OY":-60,"O4":-40,"PA":-100,"PJ":-100,"PX":-60,"P4":-100,"QA":-40,"QT":-40,"QV":-60,"QW":-60,"QX":-60,"QY":-60,"Q4":-40,"RC":-60,"RY":-30,"SS":30,"SV":-40,"SW":-40,"SX":-60,"SY":-60,"TA":-40,"TJ":-160,"TT":120,"TY":60,"T4":-40,"UA":-60,"US":-60,"U4":-60,"VA":-140,"VC":-40,"VG":-40,"VJ":-60,"VO":-40,"VQ":-40,"VS":-40,"V4":-140,"WA":-140,"WC":-40,"WG":-40,"WJ":-60,"WO":-40,"WQ":-40,"WS":-40,"W4":-140,"XC":-60,"XG":-60,"XO":-60,"XQ":-60,"XS":-40,"XT":80,"YA":-140,"YC":-80,"YG":-80,"YI":-100,"YJ":-160,"YO":-80,"YQ":-80,"YS":-60,"YT":60,"YX":-40,"YY":62,"Y4":-140,"ZT":80,"2A":-40,"24":-40,"4A":-40,"4T":-120,"4V":-60,"4W":-60,"4X":-40,"4Y":-160,"44":-40,"49":-60,"52":-50,"61":-30,"69":-60,"7A":-80,"74":-80};
// símbolo B/C da marca: B (regra par-ímpar), C e ponto [cx, cy, raio]
const BC = {"largura":367.767,"altura":240,"b":"M197.878 0L90.003 0C47.335 0 5.391 12.813 5.391 63.262C5.391 88.304 18.618 105.678 41.395 115.333C14.95 124.945 0 140.807 0 169.87C0 219.675 41.836 240 86.109 240L197.878 240L197.878 200.5C180.61 181.054 170.295 155.193 170.295 124.657C170.295 93.289 180.45 65.465 197.878 44.107L197.878 0ZM145.605 98.142L95.414 98.142C77.817 98.142 62.028 89.303 62.028 69.952C62.028 49.722 81.251 44.455 98.019 44.455L145.605 44.455L145.605 98.142ZM143.898 139.329L143.898 195.354L90.474 195.354C72.95 195.354 56.583 186.787 56.583 167.263C56.583 147.997 72.902 139.329 90.242 139.329L143.898 139.329Z","c":"M367.767 46.551L332.474 79.789C317.776 60.767 292.441 47.78 268.332 47.78C226.774 47.78 197.574 80.861 197.574 121.58C197.574 161.622 226.609 192.305 267.121 192.305C292.735 192.305 315.947 179.439 332.249 160.127L366.863 192.032C340.571 224.463 306.544 240 264.986 240C197.175 240 143.077 194.587 143.077 124.657C143.077 53.109 195.906 0 267.374 0C305.382 0 344.161 16.117 367.767 46.551Z","ponto":[170.37,120.0,18.146]};
/* </dados> */

export const VERSAO = '1.0';

// ------------------------------------------------------------------ cores
const GRAFITE = '#20231F', DOURADO = '#DEBC7E', MARFIM = '#F7F5EF';

/**
 * Paleta do selo. Em todos os tons escuros vale o esquema da logo inversa:
 * primeira letra e anel em dourado (o papel do B), segunda letra em marfim (o papel do C).
 * `automatica` diz se o tom entra no sorteio pelo nome (corDe).
 */
export const PALETA = {
  grafite:  { nome: 'Grafite',  fundo: GRAFITE,   anel: DOURADO, letra1: DOURADO, letra2: MARFIM, automatica: false },
  vinho:    { nome: 'Vinho',    fundo: '#5E2029', anel: DOURADO, letra1: DOURADO, letra2: MARFIM, automatica: true },
  ferrugem: { nome: 'Ferrugem', fundo: '#6B3413', anel: DOURADO, letra1: DOURADO, letra2: MARFIM, automatica: true },
  cafe:     { nome: 'Café',     fundo: '#402F1C', anel: DOURADO, letra1: DOURADO, letra2: MARFIM, automatica: true },
  oliva:    { nome: 'Oliva',    fundo: '#41461A', anel: DOURADO, letra1: DOURADO, letra2: MARFIM, automatica: true },
  garrafa:  { nome: 'Garrafa',  fundo: '#0E432A', anel: DOURADO, letra1: DOURADO, letra2: MARFIM, automatica: true },
  petroleo: { nome: 'Petróleo', fundo: '#08464C', anel: DOURADO, letra1: DOURADO, letra2: MARFIM, automatica: true },
  marinho:  { nome: 'Marinho',  fundo: '#17325B', anel: DOURADO, letra1: DOURADO, letra2: MARFIM, automatica: true },
  violeta:  { nome: 'Violeta',  fundo: '#3C2D5F', anel: DOURADO, letra1: DOURADO, letra2: MARFIM, automatica: true },
  ameixa:   { nome: 'Ameixa',   fundo: '#4F2343', anel: DOURADO, letra1: DOURADO, letra2: MARFIM, automatica: true },
  chumbo:   { nome: 'Chumbo',   fundo: '#3A4148', anel: DOURADO, letra1: DOURADO, letra2: MARFIM, automatica: true },
  // Alternativas claras, fora do sorteio. Nelas as duas letras ficam em grafite:
  // dourado sobre marfim (1,7:1) e marfim sobre dourado (1,7:1) não se leem.
  dourado:  { nome: 'Dourado',  fundo: DOURADO,   anel: GRAFITE, letra1: GRAFITE, letra2: GRAFITE, automatica: false },
  marfim:   { nome: 'Marfim',   fundo: MARFIM,    anel: DOURADO, letra1: GRAFITE, letra2: GRAFITE, automatica: false },
};

/** Tons que entram no sorteio pelo nome, na ordem da paleta. */
export const CORES_AUTOMATICAS = Object.keys(PALETA).filter((chave) => PALETA[chave].automatica);

/** Cor da parceria: sempre as cores da marca. */
export const COR_DA_PARCERIA = 'grafite';

// ------------------------------------------------------------------ iniciais
/** Letras reservadas à plataforma: nunca saem de iniciaisDe(). */
export const RESERVADAS = ['BC'];

const CONECTIVOS = new Set(['DE', 'DA', 'DO', 'DAS', 'DOS', 'E', 'D', 'A', 'O', 'AS', 'OS', 'EM', 'NA', 'NO', 'DEL', 'LA', 'EL', 'THE', 'OF', 'AND']);
const GENERICAS = new Set([
  'BARBEARIA', 'BARBEARIAS', 'BARBER', 'BARBERS', 'BARBERSHOP', 'BARBERIA', 'BARBEIRO', 'BARBEIROS',
  'SHOP', 'SALAO', 'STUDIO', 'ESTUDIO', 'ESPACO', 'LTDA', 'ME', 'MEI', 'EIRELI', 'EPP', 'SA',
]);

/** Nome em maiúsculas, sem acento, só com A–Z, 0–9 e espaços simples. */
export function normalizar(nome) {
  return String(nome == null ? '' : nome)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

/**
 * Duas letras (ou números) a partir do nome da barbearia.
 *  1. tira conectivos (de, da, do, e…) e palavras genéricas (barbearia, barber, studio, ltda…);
 *     se não sobrar nada, volta a considerar as genéricas;
 *  2. duas palavras ou mais: a inicial das duas primeiras;
 *  3. uma palavra: as duas primeiras letras;
 *  4. "BC" é da plataforma: nesse caso usa as duas primeiras letras da primeira palavra,
 *     e, se ainda der BC, só a primeira letra.
 * Devolve '' quando o nome não tem nenhuma letra nem número.
 */
export function iniciaisDe(nome) {
  const todas = normalizar(nome).split(' ').filter(Boolean);
  const semConectivos = todas.filter((p) => !CONECTIVOS.has(p));
  const base = semConectivos.length ? semConectivos : todas;
  const proprias = base.filter((p) => !GENERICAS.has(p));
  const palavras = proprias.length ? proprias : base;
  if (!palavras.length) return '';
  const candidatas = [
    palavras.length > 1 ? palavras[0][0] + palavras[1][0] : palavras[0].slice(0, 2),
    palavras[0].slice(0, 2),
    palavras[0][0],
  ];
  return candidatas.find((c) => !RESERVADAS.includes(c));
}

/** Só as letras válidas de um texto digitado, no máximo duas. */
function limparIniciais(texto) {
  return normalizar(texto).replace(/ /g, '').slice(0, 2);
}

/**
 * Tom do selo escolhido pelo nome: o mesmo nome dá sempre a mesma cor, sem guardar nada.
 * FNV-1a de 32 bits sobre o nome normalizado, resto da divisão pelo número de tons.
 */
export function corDe(nome) {
  const texto = normalizar(nome);
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return CORES_AUTOMATICAS[h % CORES_AUTOMATICAS.length];
}

// ------------------------------------------------------------------ medidas
// O selo é desenhado num quadrado de 240 unidades, a altura do símbolo da marca.
const LADO = 240, MEIO = LADO / 2;
const RAIO_ANEL = 96;        // centro do anel (a moldura)
const LARGURA_ANEL = 2.5;
const ALTURA_LETRA = 74;     // altura das maiúsculas
const RAIO_LETRAS = 82;      // os cantos do bloco de letras ficam dentro deste raio
// sem anel, para tamanhos pequenos
const ALTURA_SIMPLES = 96, RAIO_SIMPLES = 102;
// parceria: símbolo pequeno assinando a base do anel, com o meio do símbolo na altura das pontas do anel
const ALTURA_ASSINATURA = 32, FOLGA_ASSINATURA = 9;

// ------------------------------------------------------------------ desenho
const n = (v) => String(Math.round(v * 1000) / 1000);

/** Escala e desloca um contorno de coordenadas absolutas (M, L, Q, C, Z). */
function mover(d, k, dx, dy) {
  let i = 0;
  return d.replace(/-?\d+(?:\.\d+)?/g, (v) => n(v * k + (i++ % 2 ? dy : dx)));
}

const xml = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const circulo = (cx, cy, r) =>
  `M${n(cx - r)} ${n(cy)}A${n(r)} ${n(r)} 0 1 0 ${n(cx + r)} ${n(cy)}A${n(r)} ${n(r)} 0 1 0 ${n(cx - r)} ${n(cy)}Z`;

/** Anel inteiro, como contorno preenchido. */
function anel(cx, cor) {
  const fora = RAIO_ANEL + LARGURA_ANEL / 2, dentro = RAIO_ANEL - LARGURA_ANEL / 2;
  return `<path fill="${cor}" fill-rule="evenodd" d="${circulo(cx, MEIO, fora)}${circulo(cx, MEIO, dentro)}"/>`;
}

/** Anel aberto embaixo, para a assinatura: os cortes apontam para o centro. */
function anelAberto(cx, cor, meiaCorda) {
  const fora = RAIO_ANEL + LARGURA_ANEL / 2, dentro = RAIO_ANEL - LARGURA_ANEL / 2;
  const a = Math.asin(meiaCorda / RAIO_ANEL);
  const p = (r, lado) => `${n(cx + lado * r * Math.sin(a))} ${n(MEIO + r * Math.cos(a))}`;
  return `<path fill="${cor}" d="M${p(fora, -1)}A${n(fora)} ${n(fora)} 0 1 1 ${p(fora, 1)}L${p(dentro, 1)}A${n(dentro)} ${n(dentro)} 0 1 0 ${p(dentro, -1)}Z"/>`;
}

/** Símbolo B/C com o centro em (cx, cy). O B leva a cor do anel; o C, a da segunda letra. */
function simbolo(cx, cy, altura, corB, corC, parafuso) {
  const k = altura / BC.altura, x = cx - (BC.largura * k) / 2, y = cy - altura / 2;
  const umaCor = corB === corC;
  // Em uma cor só o ponto é um furo no próprio C, como nas logos de uma cor.
  const furo = parafuso && umaCor ? circulo(x + BC.ponto[0] * k, y + BC.ponto[1] * k, BC.ponto[2] * k) : '';
  let s = `<path fill="${corB}" fill-rule="evenodd" d="${mover(BC.b, k, x, y)}"/>`
    + `<path fill="${corC}"${furo ? ' fill-rule="evenodd"' : ''} d="${mover(BC.c, k, x, y)}${furo}"/>`;
  if (parafuso && !umaCor) s += `<circle cx="${n(x + BC.ponto[0] * k)}" cy="${n(y + BC.ponto[1] * k)}" r="${n(BC.ponto[2] * k)}" fill="${corB}"/>`;
  return s;
}

/**
 * Bloco de uma ou duas letras, centrado em (cx, cy) pela tinta e pela altura das maiúsculas.
 * Se os cantos do bloco passarem do raio seguro, o bloco inteiro é reduzido até caber.
 */
function letras(texto, cx, cy, altura, raio, cor1, cor2) {
  const pos = [];
  let x = 0;
  for (let i = 0; i < texto.length; i++) {
    if (i) x += KERNING[texto[i - 1] + texto[i]] || 0;
    pos.push(x);
    x += LETRAS[texto[i]][0];
  }
  const esquerda = pos[0] + LETRAS[texto[0]][1];
  const direita = pos[pos.length - 1] + LETRAS[texto[texto.length - 1]][2];
  let k = altura / CAP;
  const canto = Math.hypot((direita - esquerda) / 2, CAP / 2) * k;
  if (canto > raio) k *= raio / canto;
  const x0 = cx - ((esquerda + direita) / 2) * k, base = cy + (CAP * k) / 2;
  return [...texto].map((c, i) => `<path fill="${i ? cor2 : cor1}" d="${mover(LETRAS[c][3], k, x0 + pos[i] * k, base)}"/>`).join('');
}

/** Nome sem nenhuma letra: fica o ponto da marca no lugar das iniciais. */
const ponto = (cx, cy, cor) => `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(ALTURA_LETRA * 0.24)}" fill="${cor}"/>`;

/**
 * Gera o selo e devolve o SVG como texto.
 *
 * @param {object}  o
 * @param {string}  [o.nome]        Nome da barbearia. Dele saem as iniciais e, no tipo "iniciais", a cor.
 * @param {string}  [o.iniciais]    Uma ou duas letras/números, para trocar as iniciais automáticas.
 * @param {'parceria'|'iniciais'} [o.tipo='parceria']
 *        parceria: símbolo B&C + iniciais (barbearia parceira sem logo);
 *        iniciais: só as iniciais (cliente pagante sem logo).
 * @param {string}  [o.cor]         Chave de PALETA, só no tipo "iniciais". Padrão: corDe(nome). A parceria é sempre grafite.
 * @param {boolean} [o.simples=false]   Sem anel e sem símbolo, com letras maiores: para menos de 56 px.
 * @param {'redondo'|'quadrado'} [o.formato='redondo']
 *        quadrado: o fundo preenche o quadrado inteiro e o desenho fica igual. É o formato para foto de
 *        perfil (WhatsApp, Instagram, Google): o aplicativo recorta em círculo e nada se perde.
 * @param {number}  [o.tamanho=240]     Lado do SVG em pixels.
 * @returns {string} SVG
 */
export function gerarSelo(o = {}) {
  const tipo = o.tipo || 'parceria';
  if (tipo !== 'parceria' && tipo !== 'iniciais') throw new Error(`tipo inválido: "${tipo}". Use "parceria" ou "iniciais".`);
  // A parceria é sempre nas cores da marca; a cor só vale para o tipo "iniciais".
  const chave = tipo === 'parceria' ? COR_DA_PARCERIA : o.cor || corDe(o.nome);
  const cor = PALETA[chave];
  if (!cor) throw new Error(`cor inválida: "${chave}". Use ${Object.keys(PALETA).join(', ')}.`);

  const texto = o.iniciais != null && limparIniciais(o.iniciais) ? limparIniciais(o.iniciais) : iniciaisDe(o.nome);
  const altura = o.tamanho || LADO;
  const bloco = (cx, cy, h, raio) => (texto ? letras(texto, cx, cy, h, raio, cor.letra1, cor.letra2) : ponto(cx, cy, cor.letra1));
  const formato = o.formato || 'redondo';
  if (formato !== 'redondo' && formato !== 'quadrado') throw new Error(`formato inválido: "${formato}". Use "redondo" ou "quadrado".`);
  const quadrado = formato === 'quadrado';
  const disco = (cx) => quadrado
    ? `<rect width="${LADO}" height="${LADO}" fill="${cor.fundo}"/>`
    : `<circle cx="${n(cx)}" cy="${MEIO}" r="${MEIO}" fill="${cor.fundo}"/>`;

  let corpo;
  if (o.simples) {
    corpo = disco(MEIO) + bloco(MEIO, MEIO, ALTURA_SIMPLES, RAIO_SIMPLES);
  } else if (tipo === 'iniciais') {
    corpo = disco(MEIO) + anel(MEIO, cor.anel) + bloco(MEIO, MEIO, ALTURA_LETRA, RAIO_LETRAS);
  } else {
    // O anel abre embaixo e o símbolo fica no vão, centrado na linha: o meio da altura do
    // símbolo coincide com a altura em que as duas pontas do anel terminam.
    const meiaCorda = (BC.largura * ALTURA_ASSINATURA) / BC.altura / 2 + FOLGA_ASSINATURA;
    const naLinha = MEIO + Math.sqrt(RAIO_ANEL ** 2 - meiaCorda ** 2);
    corpo = disco(MEIO) + anelAberto(MEIO, cor.anel, meiaCorda)
      + simbolo(MEIO, naLinha, ALTURA_ASSINATURA, cor.anel, cor.letra2, false)
      + bloco(MEIO, MEIO, ALTURA_LETRA, RAIO_LETRAS);
  }

  const rotulo = xml([
    tipo === 'parceria' ? 'Barba & Cabelo +' : 'Selo',
    texto,
    o.nome ? `· ${String(o.nome).trim()}` : '',
  ].filter(Boolean).join(' '));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LADO} ${LADO}" width="${n(altura)}" height="${n(altura)}" role="img" aria-label="${rotulo}"><title>${rotulo}</title>${corpo}</svg>`;
}

/** SVG pronto para o src de uma <img> ou para o CSS. */
export function dataUri(svg) {
  return 'data:image/svg+xml,' + encodeURIComponent(svg).replace(/'/g, '%27');
}
