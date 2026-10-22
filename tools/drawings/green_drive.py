# Green Drive drawing, laid out from scratch: parts placed by where their pins go.
# Regenerate: python3 tools/drawings/green_drive.py, paste over the *@sch lines,
# then python3 tools/check_sch.py pedals/green-drive.cir.
L=[]
def sym(t,x,y,rot,name): L.append(f'*@sch sym {t} {x} {y} {rot} {name}')
def wire(*pts):
    for (a,b),(c,d) in zip(pts,pts[1:]): L.append(f'*@sch wire {a} {b} {c} {d}')
def flag(x,y,l): L.append(f'*@sch flag {x} {y} {l}')
def hres(x1,y,n,t='res'): sym(t,x1+96,y-16,'R90',n)        # pins (x1,y)-(x1+80,y)
def vres(x,y1,n,t='res'): sym(t,x-16,y1-16,'R0',n)         # pins (x,y1)-(x,y1+80)
def hcap(x1,y,n,t='cap'): sym(t,x1+64,y-16,'R90',n)        # pins (x1,y)-(x1+64,y)
def vcap(x,y1,n,t='cap'): sym(t,x-16,y1,'R0',n)            # pins (x,y1)-(x,y1+64)

# Input and buffer
flag(0,0,'IN'); hres(0,0,'RPICKUP'); hres(80,0,'R1'); hcap(160,0,'C1')
wire((224,0),(288,0)); vres(256,0,'R2'); flag(256,80,'Vref')
sym('npn',288,-48,'R0','Q1'); flag(352,-48,'9V'); vres(352,48,'R3'); flag(352,128,'0')
wire((352,48),(400,48)); hcap(400,48,'C2','polcap'); wire((464,48),(544,48))
vres(496,48,'R4'); flag(496,128,'Vref')
# Clipping amp: feedback stack between the In- rail (x=544) and the output rail (x=736)
sym('opamp',576,-32,'R0','XU1'); wire((576,0),(576,-16)); flag(576,-16,'9V'); wire((576,64),(576,96)); flag(576,96,'0')
hres(464,-48,'R6'); hcap(400,-48,'C3'); flag(400,-48,'0')
wire((544,16),(544,-288))
wire((608,32),(784,32)); wire((736,32),(736,-288))
hcap(544,-96+0,'C11'); wire((608,-96),(736,-96))
sym('diode',560,-144,'R270','D1'); wire((544,-160),(560,-160)); wire((624,-160),(736,-160))
sym('diode',624,-240,'R90','D3'); wire((544,-224),(560,-224)); wire((624,-224),(736,-224))
hres(544,-288,'R5'); wire((624,-288),(640,-288))
sym('pot',624,-272,'R270','XDRIVE'); wire((720,-288),(736,-288)); wire((688,-336),(640,-336),(640,-288))
# Tone stage: op-amp mirrored so its feedback and the Tone pot hang below
hres(784,32,'R7'); wire((864,32),(1056,32)); vcap(912,32,'C6'); flag(912,96,'0')
vres(992,32,'R18'); flag(992,112,'Vref'); wire((864,32),(864,240))
sym('opamp',1088,112,'M180','XU2'); wire((1088,16),(1088,-16)); flag(1088,-16,'0'); wire((1088,80),(1088,112)); flag(1088,112,'9V')
wire((1056,64),(1056,240)); hres(1056,160,'R8'); wire((1136,160),(1168,160)); wire((1168,48),(1168,160))
sym('pot',960,224,'R90','XTONE'); wire((944,240),(1056,240))
vcap(896,288,'C10'); vres(896,352,'R9'); flag(896,432,'0')
# Level and output buffer
wire((1120,48),(1200,48)); hcap(1200,48,'C5','polcap'); hres(1264,48,'R10'); wire((1344,48),(1360,48))
sym('pot',1344,32,'R0','XLEVEL'); flag(1360,128,'0')
hcap(1408,96,'C7'); wire((1472,96),(1504,96)); vres(1488,96,'R12'); flag(1488,176,'Vref')
sym('npn',1504,48,'R0','Q2'); flag(1568,48,'9V'); vres(1568,144,'R13'); flag(1568,224,'0')
hres(1568,144,'R14'); hcap(1648,144,'C8','polcap'); wire((1712,144),(1744,144)); vres(1728,144,'R15'); flag(1728,224,'0')
flag(1744,144,'OUT')
# Supply and the 4.5 V reference
vres(96,240,'R16'); flag(96,240,'9V'); flag(96,320,'Vref'); vres(96,320,'R17'); flag(96,400,'0')
wire((96,320),(160,320)); vcap(160,320,'C9','polcap'); flag(160,384,'0')
import re
def shift(x): return x + 96 * (x >= 400) + 64 * (x >= 1000)
out = []
for l in L:
    t = l.split()
    if t[1] == 'sym': t[3] = str(shift(int(t[3])))
    elif t[1] == 'wire': t[2] = str(shift(int(t[2]))); t[4] = str(shift(int(t[4])))
    elif t[1] == 'flag': t[2] = str(shift(int(t[2])))
    out.append(' '.join(t))
print('\n'.join(out))
