import{fR as ke,j as o,k as e,D as ne,y as ie,z as oe,A as le,V as c,I as h,F as ue,B as f,fS as Me,fT as _e,P as qe,O as Be,S as Ge,aF as He,aG as Ve,aH as me,x as X,aI as xe,l as re,a1 as Ye,aM as he,ax as ve,aC as Te,ah as We,a7 as Le,a3 as ze}from"./index-oFdiF8MM.js";import{A as ye,a as je,b as be,c as Ne,d as Ce,e as Ae,f as Se,g as we}from"./alert-dialog-DsBvOxn_.js";import{a as Ie,u as Xe,b as Je,c as Ke,d as Qe,e as Ze,f as et,g as tt,h as st,i as rt,j as at,k as nt,l as it}from"./useExportOrders-CCd4U6ty.js";import{T as Pe}from"./textarea-D6qmdv7r.js";import{S as J,a as K,b as Q,c as Z,d as F}from"./select-DVWH5Qgy.js";import{u as ot}from"./useCustomers-B0ck2sWr.js";import{P as ae}from"./plus-CSgoICIk.js";import{T as fe}from"./trash-2-CrnSIG5H.js";import{D as lt}from"./dollar-sign-CYX7Ftsk.js";import{F as De}from"./file-check-CVsR1NH5.js";import{P as Fe}from"./pencil-CR6SiqVY.js";import{P as $e}from"./printer-D2QRdBXy.js";const pe=()=>({_key:crypto.randomUUID(),lot_id:"",lot_ref:"",product_name:"Dattes Deglet Nour",net_weight_kg:0,unit_price:0,currency:"EUR",origin_region:"",origin_farm:"",harvest_date:"",quality_grade:"",coa_ref:""}),dt=[{value:"EU",label:"Union Européenne (EU)"},{value:"USA",label:"États-Unis (USA)"},{value:"SA",label:"Arabie Saoudite (SA)"}],ct=[{value:"fr",label:"Français"},{value:"en",label:"English"},{value:"ar",label:"العربية"}],ut=["EUR","USD","SAR","TND"],mt=["CIF","FOB","EXW","DDP","DAP","CFR"];function xt({open:s,onOpenChange:m,initial:n,onSubmit:i,isSaving:v}){const{data:j=[]}=ke({enabled:s}),{data:y=[]}=Ie(),{data:_=[]}=ot({enabled:s}),[$,N]=o.useState(""),[S,w]=o.useState(""),[P,U]=o.useState("EU"),[D,u]=o.useState(""),[M,C]=o.useState(""),[q,W]=o.useState("CIF"),[R,B]=o.useState("Tunis"),[G,A]=o.useState(""),[T,O]=o.useState("EUR"),[H,L]=o.useState("fr"),[V,b]=o.useState(""),[E,z]=o.useState([pe()]);o.useEffect(()=>{s&&(n?(w(n.customer_name),U(n.customer_country),u(n.customer_address??""),C(n.customer_contact??""),W(n.incoterms??"CIF"),B(n.port_of_loading??"Tunis"),A(n.port_of_destination??""),O(n.currency),L(n.contract_language),b(n.notes??""),z(n.lines.map(r=>({...r,_key:crypto.randomUUID()})))):(N(""),w(""),U("EU"),u(""),C(""),W("CIF"),B("Tunis"),A(""),O("EUR"),L("fr"),b(""),z([pe()])))},[s,n]);const Y=r=>{if(N(r),r==="none")return;const d=_.find(a=>a.id===r);d&&(w(d.name),U(d.country),u(d.address??""),C(d.contact_name??""),L(d.preferred_language),W(d.preferred_incoterms??"CIF"),O(d.preferred_currency),A(d.port_of_destination??""))},ee=()=>z(r=>[...r,pe()]),te=r=>z(d=>d.filter(a=>a._key!==r)),I=(r,d)=>z(a=>a.map(x=>x._key!==r?x:{...x,...d})),k=E.reduce((r,d)=>r+(d.net_weight_kg||0),0),t=E.reduce((r,d)=>r+(d.net_weight_kg||0)*(d.unit_price||0),0),g=async r=>{r.preventDefault();const d=E.map(({_key:a,...x})=>x);await i({customer_name:S,customer_country:P,customer_address:D||null,customer_contact:M||null,incoterms:q||null,port_of_loading:R||null,port_of_destination:G||null,currency:T,contract_language:H,notes:V||null,lines:d,total_weight_kg:k,total_amount:t,status:(n==null?void 0:n.status)??"draft"})};return e.jsx(ne,{open:s,onOpenChange:m,children:e.jsxs(ie,{className:"max-w-4xl max-h-[92vh] overflow-y-auto",children:[e.jsx(oe,{children:e.jsx(le,{children:n?`Modifier ${n.order_ref}`:"Nouvelle commande export"})}),e.jsxs("form",{onSubmit:g,className:"space-y-5",children:[_.length>0&&e.jsxs("div",{children:[e.jsx(c,{className:"text-xs",children:"Sélectionner un client enregistré"}),e.jsxs(J,{value:$||"none",onValueChange:Y,children:[e.jsx(K,{className:"h-10 text-sm mt-1",children:e.jsx(Q,{placeholder:"Choisir un client (optionnel)..."})}),e.jsxs(Z,{children:[e.jsx(F,{value:"none",children:"— Saisie manuelle —"}),_.map(r=>e.jsxs(F,{value:r.id,children:[r.name," · ",r.country,r.specific_country?` (${r.specific_country})`:""]},r.id))]})]})]}),e.jsxs("div",{children:[e.jsx("p",{className:"text-xs font-semibold uppercase text-muted-foreground mb-2",children:"Client"}),e.jsxs("div",{className:"grid grid-cols-2 gap-3",children:[e.jsxs("div",{className:"col-span-2",children:[e.jsx(c,{htmlFor:"eo-customer",children:"Nom client *"}),e.jsx(h,{id:"eo-customer",value:S,onChange:r=>w(r.target.value),required:!0})]}),e.jsxs("div",{children:[e.jsx(c,{htmlFor:"eo-country",children:"Pays acheteur *"}),e.jsxs(J,{value:P,onValueChange:r=>U(r),children:[e.jsx(K,{id:"eo-country",children:e.jsx(Q,{})}),e.jsx(Z,{children:dt.map(r=>e.jsx(F,{value:r.value,children:r.label},r.value))})]})]}),e.jsxs("div",{children:[e.jsx(c,{htmlFor:"eo-lang",children:"Langue contrat"}),e.jsxs(J,{value:H,onValueChange:r=>L(r),children:[e.jsx(K,{id:"eo-lang",children:e.jsx(Q,{})}),e.jsx(Z,{children:ct.map(r=>e.jsx(F,{value:r.value,children:r.label},r.value))})]})]}),e.jsxs("div",{className:"col-span-2",children:[e.jsx(c,{htmlFor:"eo-address",children:"Adresse"}),e.jsx(h,{id:"eo-address",value:D,onChange:r=>u(r.target.value)})]}),e.jsxs("div",{className:"col-span-2",children:[e.jsx(c,{htmlFor:"eo-contact",children:"Contact"}),e.jsx(h,{id:"eo-contact",value:M,onChange:r=>C(r.target.value)})]})]})]}),e.jsx(ue,{}),e.jsxs("div",{children:[e.jsx("p",{className:"text-xs font-semibold uppercase text-muted-foreground mb-2",children:"Expédition"}),e.jsxs("div",{className:"grid grid-cols-3 gap-3",children:[e.jsxs("div",{children:[e.jsx(c,{htmlFor:"eo-inco",children:"Incoterms"}),e.jsxs(J,{value:q,onValueChange:W,children:[e.jsx(K,{id:"eo-inco",children:e.jsx(Q,{})}),e.jsx(Z,{children:mt.map(r=>e.jsx(F,{value:r,children:r},r))})]})]}),e.jsxs("div",{children:[e.jsx(c,{htmlFor:"eo-port-load",children:"Port de chargement"}),e.jsx(h,{id:"eo-port-load",value:R,onChange:r=>B(r.target.value)})]}),e.jsxs("div",{children:[e.jsx(c,{htmlFor:"eo-port-dest",children:"Port de destination"}),e.jsx(h,{id:"eo-port-dest",value:G,onChange:r=>A(r.target.value)})]}),e.jsxs("div",{children:[e.jsx(c,{htmlFor:"eo-currency",children:"Devise"}),e.jsxs(J,{value:T,onValueChange:O,children:[e.jsx(K,{id:"eo-currency",children:e.jsx(Q,{})}),e.jsx(Z,{children:ut.map(r=>e.jsx(F,{value:r,children:r},r))})]})]})]})]}),e.jsx(ue,{}),e.jsxs("div",{children:[e.jsxs("div",{className:"flex items-center justify-between mb-2",children:[e.jsx("p",{className:"text-xs font-semibold uppercase text-muted-foreground",children:"Lignes de produits"}),e.jsxs(f,{type:"button",variant:"outline",size:"sm",onClick:ee,className:"gap-1 h-9 text-xs",children:[e.jsx(ae,{className:"h-3 w-3"})," Ajouter ligne"]})]}),e.jsx("div",{className:"space-y-3",children:E.map((r,d)=>{const a=j.find(l=>l.id===r.lot_id),x=y.find(l=>l.batch_id===r.lot_id);return e.jsxs("div",{className:"border rounded-lg p-3 bg-muted/20 space-y-2",children:[e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsxs("span",{className:"text-xs font-medium text-muted-foreground",children:["Ligne ",d+1]}),E.length>1&&e.jsx(f,{type:"button",variant:"ghost",size:"sm",className:"h-6 w-6 p-0 text-destructive",onClick:()=>te(r._key),children:e.jsx(fe,{className:"h-3 w-3"})})]}),e.jsxs("div",{className:"grid grid-cols-2 gap-2 sm:grid-cols-4",children:[e.jsxs("div",{className:"col-span-2",children:[e.jsx(c,{className:"text-xs",children:"Lot qualité"}),e.jsxs(J,{value:r.lot_id||"none",onValueChange:l=>{if(l==="none"){I(r._key,{lot_id:"",lot_ref:"",coa_ref:""});return}const p=j.find(ce=>ce.id===l),de=y.find(ce=>ce.batch_id===l);I(r._key,{lot_id:l,lot_ref:(p==null?void 0:p.batch_number)??l,origin_region:(p==null?void 0:p.origin_region)??"",origin_farm:(p==null?void 0:p.origin_farm)??"",harvest_date:(p==null?void 0:p.harvest_date)??"",quality_grade:(p==null?void 0:p.quality_grade)??"",coa_ref:(de==null?void 0:de.coa_ref)??""})},children:[e.jsx(K,{className:"h-10 text-sm",children:e.jsx(Q,{placeholder:"Sélectionner lot..."})}),e.jsxs(Z,{children:[e.jsx(F,{value:"none",children:"Aucun"}),j.filter(l=>l.status==="accepted"||l.quality_grade).map(l=>e.jsxs(F,{value:l.id,children:[l.batch_number," — ",l.quality_grade??"N/A"]},l.id))]})]})]}),e.jsxs("div",{className:"col-span-2",children:[e.jsx(c,{className:"text-xs",children:"Produit"}),e.jsx(h,{className:"h-10 text-sm",value:r.product_name,onChange:l=>I(r._key,{product_name:l.target.value}),placeholder:"Dattes Deglet Nour..."})]}),e.jsxs("div",{children:[e.jsx(c,{className:"text-xs",children:"Poids net (kg) *"}),e.jsx(h,{type:"number",step:"0.01",min:"0",className:"h-10 text-sm",required:!0,value:r.net_weight_kg||"",onChange:l=>I(r._key,{net_weight_kg:parseFloat(l.target.value)||0})})]}),e.jsxs("div",{children:[e.jsx(c,{className:"text-xs",children:"Prix unitaire *"}),e.jsx(h,{type:"number",step:"0.0001",min:"0",className:"h-10 text-sm",required:!0,value:r.unit_price||"",onChange:l=>I(r._key,{unit_price:parseFloat(l.target.value)||0})})]}),e.jsxs("div",{children:[e.jsx(c,{className:"text-xs",children:"Grade"}),e.jsx(h,{className:"h-10 text-sm",value:r.quality_grade??"",readOnly:!0,placeholder:"Auto depuis lot"})]}),e.jsxs("div",{children:[e.jsx(c,{className:"text-xs",children:"Réf. COA"}),e.jsx(h,{className:"h-10 text-sm font-mono",value:r.coa_ref??(x==null?void 0:x.coa_ref)??"",onChange:l=>I(r._key,{coa_ref:l.target.value}),placeholder:"COA-2026-..."})]})]}),a&&e.jsxs("div",{className:"text-xs text-muted-foreground",children:[a.origin_region&&e.jsxs("span",{children:["Région: ",a.origin_region]}),a.origin_farm&&e.jsxs("span",{className:"ml-3",children:["Exploitation: ",a.origin_farm]}),a.harvest_date&&e.jsxs("span",{className:"ml-3",children:["Récolte: ",a.harvest_date]})]}),e.jsxs("div",{className:"text-right text-xs font-semibold text-primary",children:["Sous-total: ",(r.net_weight_kg*r.unit_price).toLocaleString("fr-FR",{minimumFractionDigits:2})," ",T]})]},r._key)})}),e.jsxs("div",{className:"mt-3 flex justify-end gap-6 text-sm font-semibold border-t pt-3",children:[e.jsxs("span",{children:["Poids total: ",k.toLocaleString("fr-FR",{minimumFractionDigits:2})," kg"]}),e.jsxs("span",{className:"text-primary",children:["Montant total: ",t.toLocaleString("fr-FR",{minimumFractionDigits:2})," ",T]})]})]}),e.jsx(ue,{}),e.jsxs("div",{children:[e.jsx(c,{htmlFor:"eo-notes",children:"Notes"}),e.jsx(Pe,{id:"eo-notes",rows:2,value:V,onChange:r=>b(r.target.value)})]}),e.jsxs("div",{className:"flex justify-end gap-2",children:[e.jsx(f,{type:"button",variant:"outline",onClick:()=>m(!1),children:"Annuler"}),e.jsx(f,{type:"submit",disabled:v,children:v?"Enregistrement...":n?"Mettre à jour":"Créer commande"})]})]})]})})}function pt({open:s,onOpenChange:m,initial:n,onSubmit:i,isSaving:v}){const{data:j=[]}=ke({enabled:s}),[y,_]=o.useState(""),{data:$=[]}=Me(y,{skip:!y}),[N,S]=o.useState(""),[w,P]=o.useState(""),[U,D]=o.useState(""),[u,M]=o.useState(""),[C,q]=o.useState(""),[W,R]=o.useState(""),[B,G]=o.useState(""),[A,T]=o.useState(""),[O,H]=o.useState(""),[L,V]=o.useState(""),[b,E]=o.useState(""),[z,Y]=o.useState(""),[ee,te]=o.useState(""),[I,k]=o.useState(""),[t,g]=o.useState("");o.useEffect(()=>{s&&(n?(S(n.batch_id),P(n.batch_ref??""),D(n.supplier_name??""),M(n.origin_region??""),q(n.origin_farm??""),R(n.harvest_date??""),G(n.production_date??""),T(n.expiry_date??""),H(n.humidity_pct!=null?String(n.humidity_pct):""),V(n.mold_score!=null?String(n.mold_score):""),E(n.visual_grade??""),Y(n.net_weight_kg!=null?String(n.net_weight_kg):""),te(n.gross_weight_kg!=null?String(n.gross_weight_kg):""),k(n.approved_by??""),g(n.notes??"")):(S(""),P(""),D(""),M(""),q(""),R(""),G(""),T(""),H(""),V(""),E(""),Y(""),te(""),k(""),g("")))},[s,n]);const r=a=>{if(a==="none"){S(""),P(""),_("");return}const x=j.find(l=>l.id===a);x&&(S(a),_(a),P(x.batch_number??a),M(x.origin_region??""),q(x.origin_farm??""),R(x.harvest_date??""),E(x.quality_grade??""),Y(x.current_weight_kg!=null?String(x.current_weight_kg):""))};o.useEffect(()=>{if(!y||$.length===0)return;const a=[...$].sort((x,l)=>new Date(l.created_at??0).getTime()-new Date(x.created_at??0).getTime())[0];a.humidity_measured!=null&&H(String(a.humidity_measured)),a.mold_percentage!=null&&V(String(a.mold_percentage)),a.recommended_grade&&E(a.recommended_grade),a.weight_measured_kg!=null&&Y(String(a.weight_measured_kg))},[y,$]);const d=async a=>{a.preventDefault();const x=new Date().toISOString();await i({batch_id:N,batch_ref:w||null,supplier_name:U||null,origin_region:u||null,origin_farm:C||null,harvest_date:W||null,production_date:B||null,expiry_date:A||null,humidity_pct:O?parseFloat(O):null,mold_score:L?parseFloat(L):null,visual_grade:b||null,net_weight_kg:z?parseFloat(z):null,gross_weight_kg:ee?parseFloat(ee):null,certifications:["TN-BIO-001"],approved_by:I||null,approved_at:I?x:null,notes:t||null})};return e.jsx(ne,{open:s,onOpenChange:m,children:e.jsxs(ie,{className:"max-w-2xl max-h-[90vh] overflow-y-auto",children:[e.jsx(oe,{children:e.jsx(le,{children:n?`Modifier ${n.coa_ref}`:"Nouveau COA"})}),e.jsxs("form",{onSubmit:d,className:"space-y-4",children:[e.jsxs("div",{className:"grid grid-cols-2 gap-3",children:[e.jsxs("div",{className:"col-span-2",children:[e.jsx(c,{htmlFor:"coa-batch",children:"Lot qualité *"}),e.jsxs(J,{value:N||"none",onValueChange:r,children:[e.jsx(K,{id:"coa-batch",children:e.jsx(Q,{placeholder:"Sélectionner lot..."})}),e.jsxs(Z,{children:[e.jsx(F,{value:"none",children:"Aucun"}),j.map(a=>e.jsxs(F,{value:a.id,children:[a.batch_number," — ",a.quality_grade??"sans grade"]},a.id))]})]})]}),e.jsxs("div",{children:[e.jsx(c,{htmlFor:"coa-supplier",children:"Fournisseur"}),e.jsx(h,{id:"coa-supplier",value:U,onChange:a=>D(a.target.value)})]}),e.jsxs("div",{children:[e.jsx(c,{htmlFor:"coa-region",children:"Région d'origine"}),e.jsx(h,{id:"coa-region",value:u,onChange:a=>M(a.target.value)})]}),e.jsxs("div",{children:[e.jsx(c,{htmlFor:"coa-farm",children:"Exploitation"}),e.jsx(h,{id:"coa-farm",value:C,onChange:a=>q(a.target.value)})]}),e.jsxs("div",{children:[e.jsx(c,{htmlFor:"coa-harvest",children:"Date de récolte"}),e.jsx(h,{id:"coa-harvest",type:"date",value:W,onChange:a=>R(a.target.value)})]}),e.jsxs("div",{children:[e.jsx(c,{htmlFor:"coa-prod",children:"Date de production"}),e.jsx(h,{id:"coa-prod",type:"date",value:B,onChange:a=>G(a.target.value)})]}),e.jsxs("div",{children:[e.jsx(c,{htmlFor:"coa-expiry",children:"Date d'expiration"}),e.jsx(h,{id:"coa-expiry",type:"date",value:A,onChange:a=>T(a.target.value)})]})]}),e.jsxs("div",{className:"border rounded-lg p-3 space-y-2 bg-muted/20",children:[e.jsx("p",{className:"text-xs font-semibold uppercase text-muted-foreground",children:"Résultats d'analyse"}),e.jsxs("div",{className:"grid grid-cols-3 gap-3",children:[e.jsxs("div",{children:[e.jsx(c,{htmlFor:"coa-humidity",className:"text-xs",children:"Humidité (%)"}),e.jsx(h,{id:"coa-humidity",type:"number",step:"0.1",min:"0",max:"100",className:"h-10",value:O,onChange:a=>H(a.target.value)})]}),e.jsxs("div",{children:[e.jsx(c,{htmlFor:"coa-mold",className:"text-xs",children:"Score moisissure"}),e.jsx(h,{id:"coa-mold",type:"number",step:"0.1",min:"0",className:"h-10",value:L,onChange:a=>V(a.target.value)})]}),e.jsxs("div",{children:[e.jsx(c,{htmlFor:"coa-grade",className:"text-xs",children:"Grade visuel"}),e.jsxs(J,{value:b||"none",onValueChange:a=>E(a==="none"?"":a),children:[e.jsx(K,{id:"coa-grade",className:"h-10",children:e.jsx(Q,{})}),e.jsxs(Z,{children:[e.jsx(F,{value:"none",children:"—"}),e.jsx(F,{value:"premium",children:"Premium"}),e.jsx(F,{value:"standard",children:"Standard"}),e.jsx(F,{value:"economy",children:"Économique"}),e.jsx(F,{value:"rejected",children:"Rejeté"})]})]})]}),e.jsxs("div",{children:[e.jsx(c,{htmlFor:"coa-net",className:"text-xs",children:"Poids net (kg)"}),e.jsx(h,{id:"coa-net",type:"number",step:"0.01",min:"0",className:"h-10",value:z,onChange:a=>Y(a.target.value)})]}),e.jsxs("div",{children:[e.jsx(c,{htmlFor:"coa-gross",className:"text-xs",children:"Poids brut (kg)"}),e.jsx(h,{id:"coa-gross",type:"number",step:"0.01",min:"0",className:"h-10",value:ee,onChange:a=>te(a.target.value)})]})]})]}),e.jsxs("div",{children:[e.jsx(c,{htmlFor:"coa-approved",children:"Approuvé par"}),e.jsx(h,{id:"coa-approved",value:I,onChange:a=>k(a.target.value),placeholder:"Nom du responsable qualité"})]}),e.jsxs("div",{children:[e.jsx(c,{htmlFor:"coa-notes",children:"Observations"}),e.jsx(Pe,{id:"coa-notes",rows:2,value:t,onChange:a=>g(a.target.value)})]}),e.jsxs("div",{className:"flex justify-end gap-2",children:[e.jsx(f,{type:"button",variant:"outline",onClick:()=>m(!1),children:"Annuler"}),e.jsx(f,{type:"submit",disabled:v||!N,children:v?"Enregistrement...":n?"Mettre à jour":"Créer COA"})]})]})]})})}const gt={fr:{title:"CONTRAT DE VENTE À L'EXPORT",contract_ref:"Référence contrat",order_ref:"Référence commande",version:"Version",date:"Date",seller:"VENDEUR",buyer:"ACHETEUR",country:"Pays",address:"Adresse",contact:"Contact",incoterms:"Incoterms",port_loading:"Port de chargement",port_dest:"Port de destination",products:"DÉTAIL DES PRODUITS",lot_ref:"Référence lot",product:"Produit",origin:"Origine",harvest:"Récolte",grade:"Grade",net_weight:"Poids net (kg)",unit_price:"Prix unitaire",total:"Total",grand_total:"TOTAL GÉNÉRAL",traceability:"TRAÇABILITÉ & CERTIFICATIONS",coa_ref:"Réf. COA",certif:"Certifications",special_clauses:"CLAUSES SPÉCIALES",signatures:"SIGNATURES",seller_sig:"Signature vendeur",buyer_sig:"Signature acheteur",date_sig:"Date",page:"Page",generated:"Document généré le",hash:"Empreinte SHA-256",status_locked:"DOCUMENT VERROUILLÉ — approuvé et signé électroniquement"},en:{title:"EXPORT SALES CONTRACT",contract_ref:"Contract reference",order_ref:"Order reference",version:"Version",date:"Date",seller:"SELLER",buyer:"BUYER",country:"Country",address:"Address",contact:"Contact",incoterms:"Incoterms",port_loading:"Port of loading",port_dest:"Port of destination",products:"PRODUCT DETAILS",lot_ref:"Lot reference",product:"Product",origin:"Origin",harvest:"Harvest date",grade:"Grade",net_weight:"Net weight (kg)",unit_price:"Unit price",total:"Total",grand_total:"GRAND TOTAL",traceability:"TRACEABILITY & CERTIFICATIONS",coa_ref:"COA Ref.",certif:"Certifications",special_clauses:"SPECIAL CLAUSES",signatures:"SIGNATURES",seller_sig:"Seller signature",buyer_sig:"Buyer signature",date_sig:"Date",page:"Page",generated:"Document generated on",hash:"SHA-256 fingerprint",status_locked:"LOCKED DOCUMENT — electronically approved and signed"},ar:{title:"عقد بيع للتصدير",contract_ref:"مرجع العقد",order_ref:"مرجع الطلب",version:"الإصدار",date:"التاريخ",seller:"البائع",buyer:"المشتري",country:"البلد",address:"العنوان",contact:"جهة الاتصال",incoterms:"شروط التسليم",port_loading:"ميناء الشحن",port_dest:"ميناء الوجهة",products:"تفاصيل المنتجات",lot_ref:"مرجع الدفعة",product:"المنتج",origin:"المنشأ",harvest:"تاريخ الحصاد",grade:"الدرجة",net_weight:"الوزن الصافي (كغ)",unit_price:"سعر الوحدة",total:"المجموع",grand_total:"المجموع الإجمالي",traceability:"إمكانية التتبع والشهادات",coa_ref:"مرجع COA",certif:"الشهادات",special_clauses:"بنود خاصة",signatures:"التواقيع",seller_sig:"توقيع البائع",buyer_sig:"توقيع المشتري",date_sig:"التاريخ",page:"صفحة",generated:"تم إنشاء المستند في",hash:"بصمة SHA-256",status_locked:"مستند مقفل — تمت الموافقة عليه والتوقيع إلكترونيًا"}},ht={EU:{fr:["<strong>Incoterms 2020 :</strong> Les présentes conditions sont régies par les Incoterms 2020 de la CCI.","<strong>Règlement EUDR (UE 2023/1115) :</strong> Le vendeur garantit que les produits proviennent de terres non soumises à la déforestation après le 31 décembre 2020, conformément au règlement de l'Union européenne sur la déforestation.","<strong>Certification biologique :</strong> Les lots livré portent la certification TN-BIO-001 reconnue en équivalence avec le règlement (CE) 834/2007.","<strong>Traçabilité :</strong> Un certificat d'analyse (COA) par lot est joint au présent contrat."],en:["<strong>Incoterms 2020:</strong> These terms are governed by ICC Incoterms 2020.","<strong>EUDR Compliance (EU 2023/1115):</strong> The seller certifies that products originate from land not subject to deforestation after 31 December 2020, in accordance with the EU Deforestation Regulation.","<strong>Organic Certification:</strong> Delivered lots carry the TN-BIO-001 certification recognised in equivalence with Regulation (EC) 834/2007.","<strong>Traceability:</strong> A Certificate of Analysis (COA) per lot is attached to this contract."],ar:["<strong>إنكوترمز 2020:</strong> تخضع هذه الشروط لإنكوترمز 2020 الصادر عن غرفة التجارة الدولية.","<strong>الامتثال لـ EUDR (الاتحاد الأوروبي 2023/1115):</strong> يؤكد البائع أن المنتجات تأتي من أراضٍ غير خاضعة لإزالة الغابات بعد 31 ديسمبر 2020.","<strong>شهادة عضوية:</strong> الدفعات المسلمة تحمل شهادة TN-BIO-001.","<strong>إمكانية التتبع:</strong> يُرفق بهذا العقد شهادة تحليل (COA) لكل دفعة."]},USA:{fr:["<strong>FDA Prior Notice :</strong> Conformément au Bioterrorism Act of 2002, un Prior Notice a été soumis à la FDA avant expédition. Référence à indiquer sur les documents douaniers.","<strong>Incoterms 2020 :</strong> Les présentes conditions sont régies par les Incoterms 2020 de la CCI.","<strong>FSMA :</strong> Les conditions de production et d'hygiène sont conformes au Food Safety Modernization Act (FSMA, 21 CFR Part 112).","<strong>Étiquetage :</strong> Les étiquettes produit sont conformes aux exigences FDA 21 CFR Part 101."],en:["<strong>FDA Prior Notice:</strong> Pursuant to the Bioterrorism Act of 2002, a Prior Notice has been submitted to the FDA prior to shipment. Reference to be indicated on customs documents.","<strong>Incoterms 2020:</strong> These terms are governed by ICC Incoterms 2020.","<strong>FSMA Compliance:</strong> Production and hygiene conditions comply with the Food Safety Modernization Act (FSMA, 21 CFR Part 112).","<strong>Labeling:</strong> Product labels comply with FDA 21 CFR Part 101 requirements."],ar:["<strong>إشعار FDA المسبق:</strong> تم تقديم إشعار مسبق إلى إدارة الغذاء والدواء الأمريكية قبل الشحن وفقًا لقانون مكافحة الإرهاب البيولوجي لعام 2002.","<strong>إنكوترمز 2020:</strong> تخضع هذه الشروط لإنكوترمز 2020.","<strong>الامتثال لـ FSMA:</strong> تتوافق ظروف الإنتاج والنظافة مع قانون تحديث سلامة الغذاء."]},SA:{fr:["<strong>SFDA :</strong> Les produits sont conformes aux exigences de la Saudi Food and Drug Authority (SFDA). Numéro d'enregistrement importateur : à compléter par l'acheteur.","<strong>Halal :</strong> Les produits sont certifiés Halal conformément aux normes de l'Organisation islamique pour la sécurité alimentaire (OISA/SMIIC).","<strong>Étiquetage arabe :</strong> Les étiquettes comportent les mentions obligatoires en langue arabe conformément aux réglementations GCC.","<strong>Incoterms 2020 :</strong> CIF Jeddah / Dammam, sauf accord contraire."],en:["<strong>SFDA Compliance:</strong> Products comply with Saudi Food and Drug Authority (SFDA) requirements. Importer registration number: to be completed by the buyer.","<strong>Halal Certification:</strong> Products are Halal certified in accordance with the Islamic Organisation for Food Security (IOFS/SMIIC) standards.","<strong>Arabic Labeling:</strong> Labels include mandatory mentions in Arabic language in accordance with GCC regulations.","<strong>Incoterms 2020:</strong> CIF Jeddah / Dammam, unless otherwise agreed."],ar:["<strong>الامتثال لـ SFDA:</strong> تستوفي المنتجات متطلبات الهيئة السعودية للغذاء والدواء. رقم تسجيل المستورد: يكمله المشتري.","<strong>شهادة حلال:</strong> المنتجات معتمدة حلال وفقًا لمعايير المنظمة الإسلامية لسلامة الغذاء.","<strong>الملصقات العربية:</strong> تتضمن الملصقات البيانات الإلزامية باللغة العربية وفق لوائح مجلس التعاون.","<strong>إنكوترمز 2020:</strong> CIF جدة / الدمام، ما لم يُتفق على خلاف ذلك."]}};function Ue(s,m){var D;const n=m.language,i=gt[n],v=((D=ht[m.buyer_country])==null?void 0:D[n])??[],j=n==="ar",y=j?"rtl":"ltr",_=new Date().toLocaleDateString("fr-FR"),N={EUR:"€",USD:"$",SAR:"SAR ",TND:"TND "}[s.currency]??s.currency+" ",S=s.lines.map(u=>`
    <tr>
      <td style="border:1px solid #1a5276;padding:4px 6px;font-family:monospace;font-size:11px">${u.lot_ref}</td>
      <td style="border:1px solid #1a5276;padding:4px 6px;font-size:11px">${u.product_name}</td>
      <td style="border:1px solid #1a5276;padding:4px 6px;font-size:11px">${u.origin_region??""} ${u.origin_farm?`— ${u.origin_farm}`:""}</td>
      <td style="border:1px solid #1a5276;padding:4px 6px;font-size:11px;text-align:center">${u.harvest_date??""}</td>
      <td style="border:1px solid #1a5276;padding:4px 6px;font-size:11px;text-align:center">${u.quality_grade??""}</td>
      <td style="border:1px solid #1a5276;padding:4px 6px;font-size:11px;text-align:right">${u.net_weight_kg.toLocaleString("fr-FR",{minimumFractionDigits:2})}</td>
      <td style="border:1px solid #1a5276;padding:4px 6px;font-size:11px;text-align:right">${N}${u.unit_price.toFixed(4)}</td>
      <td style="border:1px solid #1a5276;padding:4px 6px;font-size:11px;text-align:right;font-weight:600">${N}${(u.net_weight_kg*u.unit_price).toLocaleString("fr-FR",{minimumFractionDigits:2})}</td>
    </tr>
  `).join(""),w=s.lines.map(u=>`
    <tr>
      <td style="border:1px solid #ccc;padding:3px 6px;font-family:monospace;font-size:10px">${u.lot_ref}</td>
      <td style="border:1px solid #ccc;padding:3px 6px;font-size:10px">${u.product_name}</td>
      <td style="border:1px solid #ccc;padding:3px 6px;font-size:10px;font-family:monospace">${u.coa_ref??"—"}</td>
      <td style="border:1px solid #ccc;padding:3px 6px;font-size:10px">TN-BIO-001</td>
    </tr>
  `).join(""),P=v.map(u=>`<li style="margin-bottom:6px;font-size:11px">${u}</li>`).join(""),U=m.status==="locked"?`
    <div style="background:#065f46;color:white;text-align:center;padding:8px;font-size:11px;font-weight:600;margin-bottom:12px;border-radius:4px">
      ${i.status_locked}
    </div>
    <div style="text-align:center;font-size:9px;color:#555;margin-bottom:12px;font-family:monospace">
      ${i.hash}: ${m.doc_hash??"—"}
    </div>
  `:"";return`<!DOCTYPE html>
<html lang="${n}" dir="${y}">
<head>
  <meta charset="UTF-8"/>
  <title>${i.title} — ${m.contract_ref}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; margin: 0; padding: 0; }
    @page { size: A4; margin: 14mm; }
    @media print { body { margin: 0; } }
    .page { width: 210mm; min-height: 297mm; padding: 14mm; margin: 0 auto; }
    table { border-collapse: collapse; width: 100%; }
    th { background: #1a5276; color: white; padding: 5px 6px; font-size: 10px; }
    section { margin-bottom: 16px; }
    h2 { font-size: 12px; color: #1a5276; border-bottom: 1.5px solid #1a5276; padding-bottom: 4px; margin-bottom: 8px; text-transform: uppercase; }
  </style>
</head>
<body>
<div class="page">
  ${U}

  <!-- Header -->
  <div style="display:flex;align-items:stretch;border:2px solid #1a5276;margin-bottom:12px">
    <div style="min-width:100px;border-right:1px solid #1a5276;display:flex;align-items:center;justify-content:center;padding:8px">
      <div style="text-align:center">
        <div style="color:#107754;font-weight:700;font-size:16px;line-height:1.1">Royal</div>
        <div style="color:#107754;font-weight:700;font-size:16px;line-height:1.1">Palm</div>
        <div style="color:#888;font-size:8px">Group</div>
      </div>
    </div>
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:10px;border-right:1px solid #1a5276">
      <div style="font-size:15px;font-weight:700;color:#1a5276;text-align:center">${i.title}</div>
      <div style="font-size:10px;color:#555;margin-top:4px">Groupe Ennour Investissement — Tozeur, Tunisie</div>
    </div>
    <div style="min-width:160px;padding:10px;font-size:10px;display:flex;flex-direction:column;gap:3px">
      <div><strong>${i.contract_ref} :</strong> ${m.contract_ref}</div>
      <div><strong>${i.order_ref} :</strong> ${s.order_ref}</div>
      <div><strong>${i.version} :</strong> v${m.current_version}</div>
      <div><strong>${i.date} :</strong> ${_}</div>
    </div>
  </div>

  <!-- Parties -->
  <section>
    <div style="display:flex;gap:12px">
      <div style="flex:1;border:1px solid #1a5276;padding:8px">
        <div style="font-size:10px;font-weight:700;color:#1a5276;margin-bottom:6px;text-transform:uppercase">${i.seller}</div>
        <div style="font-size:11px;font-weight:700">Groupe Ennour Investissement</div>
        <div style="font-size:10px;color:#555">Route de Nefta, Tozeur 2200, Tunisie</div>
        <div style="font-size:10px;color:#555">MF : 1234567 / A / M / 000</div>
        <div style="font-size:10px;color:#555">Tél : +216 76 000 000</div>
      </div>
      <div style="flex:1;border:1px solid #1a5276;padding:8px">
        <div style="font-size:10px;font-weight:700;color:#1a5276;margin-bottom:6px;text-transform:uppercase">${i.buyer}</div>
        <div style="font-size:11px;font-weight:700">${s.customer_name}</div>
        ${s.customer_address?`<div style="font-size:10px;color:#555">${s.customer_address}</div>`:""}
        ${s.customer_contact?`<div style="font-size:10px;color:#555">${s.customer_contact}</div>`:""}
        <div style="font-size:10px;color:#555">${i.country} : ${s.customer_country}</div>
      </div>
      <div style="min-width:150px;border:1px solid #1a5276;padding:8px;font-size:10px;display:flex;flex-direction:column;gap:3px">
        ${s.incoterms?`<div><strong>${i.incoterms} :</strong> ${s.incoterms}</div>`:""}
        ${s.port_of_loading?`<div><strong>${i.port_loading} :</strong> ${s.port_of_loading}</div>`:""}
        ${s.port_of_destination?`<div><strong>${i.port_dest} :</strong> ${s.port_of_destination}</div>`:""}
      </div>
    </div>
  </section>

  <!-- Product lines -->
  <section>
    <h2>${i.products}</h2>
    <table>
      <thead>
        <tr>
          <th>${i.lot_ref}</th>
          <th>${i.product}</th>
          <th>${i.origin}</th>
          <th>${i.harvest}</th>
          <th>${i.grade}</th>
          <th>${i.net_weight}</th>
          <th>${i.unit_price}</th>
          <th>${i.total}</th>
        </tr>
      </thead>
      <tbody>
        ${S}
        <tr>
          <td colspan="5" style="border:1px solid #1a5276;padding:4px 6px;font-size:11px;font-weight:700;background:#eaf4fb;text-align:right">${i.grand_total}</td>
          <td style="border:1px solid #1a5276;padding:4px 6px;font-size:11px;font-weight:700;text-align:right">${s.total_weight_kg.toLocaleString("fr-FR",{minimumFractionDigits:2})} kg</td>
          <td style="border:1px solid #1a5276"></td>
          <td style="border:1px solid #1a5276;padding:4px 6px;font-size:12px;font-weight:700;text-align:right;color:#1a5276">${N}${s.total_amount.toLocaleString("fr-FR",{minimumFractionDigits:2})}</td>
        </tr>
      </tbody>
    </table>
  </section>

  <!-- Traceability & COA -->
  <section>
    <h2>${i.traceability}</h2>
    <table>
      <thead>
        <tr>
          <th>${i.lot_ref}</th>
          <th>${i.product}</th>
          <th>${i.coa_ref}</th>
          <th>${i.certif}</th>
        </tr>
      </thead>
      <tbody>
        ${w}
      </tbody>
    </table>
  </section>

  <!-- Special clauses -->
  <section>
    <h2>${i.special_clauses}</h2>
    <ul style="margin:0;padding-left:${j?"0":"18px"};padding-right:${j?"18px":"0"}">
      ${P}
    </ul>
  </section>

  <!-- Signatures -->
  <section>
    <h2>${i.signatures}</h2>
    <div style="display:flex;gap:24px;margin-top:8px">
      <div style="flex:1;border-top:1.5px solid #1a5276;padding-top:8px">
        <div style="font-size:10px;font-weight:600;color:#1a5276;margin-bottom:24px">${i.seller_sig}</div>
        <div style="font-size:10px;color:#555">${i.date_sig} : ___________________</div>
      </div>
      <div style="flex:1;border-top:1.5px solid #1a5276;padding-top:8px">
        <div style="font-size:10px;font-weight:600;color:#1a5276;margin-bottom:24px">${i.buyer_sig}</div>
        <div style="font-size:10px;color:#555">${i.date_sig} : ___________________</div>
      </div>
    </div>
  </section>

  <!-- Footer -->
  <div style="border-top:1px solid #1a5276;padding-top:6px;font-size:8.5px;color:#777;display:flex;justify-content:space-between;margin-top:12px">
    <span>${i.generated} ${_} — ${m.contract_ref} v${m.current_version}</span>
    <span>Royal Palm Group — Groupe Ennour Investissement, Tozeur</span>
  </div>
</div>
</body>
</html>`}function ft(s,m){return Ue(s,m)}function vt(s,m){const n=Ue(s,m),i=window.open("","_blank","width=900,height=1200");i&&(i.document.write(n),i.document.close(),i.focus(),setTimeout(()=>{i.print()},400))}function _t(s){const m=new Date().toLocaleDateString("fr-FR"),n=`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <title>COA — ${s.coa_ref}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; margin: 0; }
    @page { size: A4; margin: 14mm; }
    .page { width: 210mm; min-height: 297mm; padding: 14mm; margin: 0 auto; }
    table { border-collapse: collapse; width: 100%; }
    th { background: #1a5276; color: white; padding: 5px 8px; font-size: 10px; text-align: left; }
    td { border: 1px solid #ccc; padding: 4px 8px; font-size: 11px; }
    .label { background: #eaf4fb; font-weight: 600; width: 40%; }
    h2 { font-size: 12px; color: #1a5276; border-bottom: 1.5px solid #1a5276; padding-bottom: 4px; margin: 14px 0 8px; text-transform: uppercase; }
    .pass { color: #065f46; font-weight: 700; }
    .fail { color: #991b1b; font-weight: 700; }
  </style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div style="display:flex;align-items:stretch;border:2px solid #1a5276;margin-bottom:14px">
    <div style="min-width:100px;border-right:1px solid #1a5276;display:flex;align-items:center;justify-content:center;padding:8px">
      <div style="text-align:center">
        <div style="color:#107754;font-weight:700;font-size:16px;line-height:1.1">Royal</div>
        <div style="color:#107754;font-weight:700;font-size:16px;line-height:1.1">Palm</div>
        <div style="color:#888;font-size:8px">Group</div>
      </div>
    </div>
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:10px;border-right:1px solid #1a5276">
      <div style="font-size:15px;font-weight:700;color:#1a5276">CERTIFICAT D'ANALYSE (COA)</div>
      <div style="font-size:10px;color:#555;margin-top:4px">Certificate of Analysis</div>
    </div>
    <div style="min-width:160px;padding:10px;font-size:10px;display:flex;flex-direction:column;gap:3px">
      <div><strong>Réf. COA :</strong> <span style="font-family:monospace">${s.coa_ref}</span></div>
      <div><strong>Lot :</strong> <span style="font-family:monospace">${s.batch_ref??"—"}</span></div>
      <div><strong>Date :</strong> ${m}</div>
      ${s.expiry_date?`<div><strong>Expiration :</strong> ${s.expiry_date}</div>`:""}
    </div>
  </div>

  <!-- Identification -->
  <h2>Identification du Lot</h2>
  <table>
    <tbody>
      <tr><td class="label">Référence lot interne</td><td style="font-family:monospace">${s.batch_ref??"—"}</td></tr>
      <tr><td class="label">Fournisseur</td><td>${s.supplier_name??"—"}</td></tr>
      <tr><td class="label">Région d'origine</td><td>${s.origin_region??"—"}</td></tr>
      <tr><td class="label">Exploitation</td><td>${s.origin_farm??"—"}</td></tr>
      <tr><td class="label">Date de récolte</td><td>${s.harvest_date??"—"}</td></tr>
      <tr><td class="label">Date de production</td><td>${s.production_date??"—"}</td></tr>
      <tr><td class="label">Date d'expiration</td><td>${s.expiry_date??"—"}</td></tr>
      <tr><td class="label">Certifications</td><td>${s.certifications.join(", ")||"—"}</td></tr>
    </tbody>
  </table>

  <!-- Résultats d'analyse -->
  <h2>Résultats d'Analyse</h2>
  <table>
    <thead>
      <tr>
        <th>Paramètre</th>
        <th>Valeur mesurée</th>
        <th>Norme / Limite</th>
        <th>Résultat</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Humidité (%)</td>
        <td>${s.humidity_pct!=null?s.humidity_pct+" %":"—"}</td>
        <td>14 % – 18 %</td>
        <td class="${s.humidity_pct!=null?s.humidity_pct>=14&&s.humidity_pct<=18?"pass":"fail":""}">
          ${s.humidity_pct!=null?s.humidity_pct>=14&&s.humidity_pct<=18?"✓ CONFORME":"✗ NON CONFORME":"—"}
        </td>
      </tr>
      <tr>
        <td>Score moisissure</td>
        <td>${s.mold_score!=null?s.mold_score:"—"}</td>
        <td>≤ 1</td>
        <td class="${s.mold_score!=null?s.mold_score<=1?"pass":"fail":""}">
          ${s.mold_score!=null?s.mold_score<=1?"✓ CONFORME":"✗ NON CONFORME":"—"}
        </td>
      </tr>
      <tr>
        <td>Grade visuel</td>
        <td>${s.visual_grade??"—"}</td>
        <td>Premium / Standard</td>
        <td class="${s.visual_grade?["premium","standard"].includes(s.visual_grade)?"pass":"fail":""}">
          ${s.visual_grade?["premium","standard"].includes(s.visual_grade)?"✓ CONFORME":"✗ NON CONFORME":"—"}
        </td>
      </tr>
      <tr>
        <td>Poids net (kg)</td>
        <td>${s.net_weight_kg!=null?s.net_weight_kg.toLocaleString("fr-FR",{minimumFractionDigits:2})+" kg":"—"}</td>
        <td>—</td>
        <td>—</td>
      </tr>
      <tr>
        <td>Poids brut (kg)</td>
        <td>${s.gross_weight_kg!=null?s.gross_weight_kg.toLocaleString("fr-FR",{minimumFractionDigits:2})+" kg":"—"}</td>
        <td>—</td>
        <td>—</td>
      </tr>
    </tbody>
  </table>

  ${s.notes?`
  <h2>Observations</h2>
  <div style="border:1px solid #ccc;padding:8px;font-size:11px;background:#fafafa">${s.notes}</div>
  `:""}

  <!-- Approbation -->
  <h2>Approbation</h2>
  <div style="display:flex;gap:16px;margin-top:8px">
    <div style="flex:1;border:1px solid #1a5276;padding:8px">
      <div style="font-size:10px;font-weight:600;color:#1a5276;margin-bottom:4px">Approuvé par</div>
      <div style="font-size:11px">${s.approved_by??"___________________"}</div>
      <div style="font-size:10px;color:#555;margin-top:4px">Date : ${s.approved_at?new Date(s.approved_at).toLocaleDateString("fr-FR"):"___________________"}</div>
    </div>
    <div style="flex:1;border:1px solid #1a5276;padding:8px">
      <div style="font-size:10px;font-weight:600;color:#1a5276;margin-bottom:4px">Visa qualité</div>
      <div style="font-size:11px">___________________</div>
      <div style="font-size:10px;color:#555;margin-top:4px">Date : ___________________</div>
    </div>
  </div>

  <!-- Footer -->
  <div style="border-top:1px solid #1a5276;padding-top:6px;font-size:8.5px;color:#777;display:flex;justify-content:space-between;margin-top:14px">
    <span>COA ${s.coa_ref} — Généré le ${m}</span>
    <span>Royal Palm Group — Groupe Ennour Investissement, Tozeur, Tunisie</span>
  </div>
</div>
</body>
</html>`,i=window.open("","_blank","width=900,height=1200");i&&(i.document.write(n),i.document.close(),i.focus(),setTimeout(()=>{i.print()},400))}const Re={draft:{label:"Brouillon",cls:"bg-amber-50 text-amber-800 border-amber-200"},confirmed:{label:"Confirmé",cls:"bg-blue-50 text-blue-800 border-blue-200"},shipped:{label:"Expédié",cls:"bg-purple-50 text-purple-800 border-purple-200"},completed:{label:"Terminé",cls:"bg-emerald-50 text-emerald-800 border-emerald-200"},cancelled:{label:"Annulé",cls:"bg-red-50 text-red-700 border-red-200"}},Oe={draft:{label:"Brouillon",cls:"bg-amber-50 text-amber-800 border-amber-200",icon:he},pending_approval:{label:"En attente",cls:"bg-blue-50 text-blue-800 border-blue-200",icon:We},approved:{label:"Approuvé",cls:"bg-emerald-50 text-emerald-800 border-emerald-200",icon:Te},locked:{label:"Verrouillé",cls:"bg-slate-100 text-slate-700 border-slate-300",icon:ve}},ge={EU:"🇪🇺 UE",USA:"🇺🇸 USA",SA:"🇸🇦 KSA"},Ee={fr:"FR",en:"EN",ar:"AR"},se={draft:{status:"confirmed",label:"Confirmer",cls:"text-blue-600 hover:text-blue-700"},confirmed:{status:"shipped",label:"Expédier",cls:"text-purple-600 hover:text-purple-700"},shipped:{status:"completed",label:"Terminer",cls:"text-emerald-600 hover:text-emerald-700"}};function yt({contract:s,order:m,open:n,onOpenChange:i}){const[v,j]=o.useState(""),y=nt(),_=async()=>{if(!m)return;const $=ft(m,s);await y.mutateAsync({contract:s,approvedBy:v,htmlContent:$}),i(!1)};return e.jsx(ne,{open:n,onOpenChange:i,children:e.jsxs(ie,{className:"max-w-sm",children:[e.jsx(oe,{children:e.jsx(le,{children:"Approuver le contrat"})}),e.jsxs("p",{className:"text-sm text-muted-foreground",children:["Cette action va verrouiller le document ",s.contract_ref," v",s.current_version," avec une empreinte SHA-256. Il ne pourra plus être modifié."]}),e.jsx("div",{children:e.jsx(h,{placeholder:"Votre nom",value:v,onChange:$=>j($.target.value)})}),e.jsxs(ze,{children:[e.jsx(f,{variant:"outline",onClick:()=>i(!1),children:"Annuler"}),e.jsxs(f,{onClick:_,disabled:!v||y.isPending,children:[e.jsx(ve,{className:"h-4 w-4 mr-1"}),y.isPending?"Verrouillage...":"Approuver & Verrouiller"]})]})]})})}function jt({contract:s,open:m,onOpenChange:n}){const[i,v]=o.useState(""),[j,y]=o.useState(""),_=it(),$=async()=>{await _.mutateAsync({contract:s,generatedBy:i,reason:j}),n(!1)},[N,S]=s.current_version.split(".").map(Number);return e.jsx(ne,{open:m,onOpenChange:n,children:e.jsxs(ie,{className:"max-w-sm",children:[e.jsx(oe,{children:e.jsx(le,{children:"Régénérer le contrat"})}),e.jsxs("p",{className:"text-sm text-muted-foreground",children:["La version actuelle v",s.current_version," sera archivée. Une nouvelle version v",N,".",S+1," sera créée."]}),e.jsxs("div",{className:"space-y-2",children:[e.jsx(h,{placeholder:"Votre nom",value:i,onChange:w=>v(w.target.value)}),e.jsx(h,{placeholder:"Raison de la correction...",value:j,onChange:w=>y(w.target.value)})]}),e.jsxs(ze,{children:[e.jsx(f,{variant:"outline",onClick:()=>n(!1),children:"Annuler"}),e.jsxs(f,{onClick:$,disabled:!i||!j||_.isPending,children:[e.jsx(Le,{className:"h-4 w-4 mr-1"}),_.isPending?"Création...":"Créer v"+N+"."+(S+1)]})]})]})})}function kt(){const{data:s=[],isLoading:m}=Xe(),{data:n=[],isLoading:i}=Je(),{data:v=[],isLoading:j}=Ie(),y=Ke(),_=Qe(),$=Ze(),N=et();tt();const S=st(),w=rt(),P=at(),[U,D]=o.useState(!1),[u,M]=o.useState(null),[C,q]=o.useState(null),[W,R]=o.useState(!1),[B,G]=o.useState(null),[A,T]=o.useState(null),[O,H]=o.useState(null),[L,V]=o.useState(null),[b,E]=o.useState(""),z=o.useMemo(()=>{if(!b)return s;const t=b.toLowerCase();return s.filter(g=>{var r,d,a;return((r=g.order_ref)==null?void 0:r.toLowerCase().includes(t))||((d=g.customer_name)==null?void 0:d.toLowerCase().includes(t))||((a=g.customer_country)==null?void 0:a.toLowerCase().includes(t))})},[s,b]),Y=o.useMemo(()=>{if(!b)return v;const t=b.toLowerCase();return v.filter(g=>{var r,d,a;return((r=g.coa_ref)==null?void 0:r.toLowerCase().includes(t))||((d=g.batch_ref)==null?void 0:d.toLowerCase().includes(t))||((a=g.supplier_name)==null?void 0:a.toLowerCase().includes(t))})},[v,b]),ee=o.useCallback(async t=>{try{u?await _.mutateAsync({id:u.id,...t}):await y.mutateAsync(t),D(!1)}catch{}},[u,_,y]),te=o.useCallback(async t=>{try{B?await w.mutateAsync({id:B.id,...t}):await S.mutateAsync(t),R(!1)}catch{}},[B,w,S]),I=o.useCallback(async t=>{if(!n.find(r=>r.order_id===t.id))try{await N.mutateAsync({order_id:t.id,order_ref:t.order_ref,language:t.contract_language,buyer_country:t.customer_country,status:"draft",current_version:"1.0",version_history:[]})}catch{}},[n,N]),k=o.useMemo(()=>{const t=s.filter(l=>l.status!=="cancelled"),g=s.filter(l=>l.status==="shipped"||l.status==="completed").length,r=Object.entries(t.reduce((l,p)=>(l[p.customer_country]=(l[p.customer_country]??0)+p.total_weight_kg,l),{})).sort((l,p)=>p[1]-l[1]),d=n.filter(l=>l.status==="locked").length,a=s.length>0?Math.round(v.length/Math.max(s.reduce((l,p)=>l+p.lines.length,0),1)*100):0,x=t.reduce((l,p)=>(l[p.currency]=(l[p.currency]??0)+p.total_amount,l),{});return{activeOrders:t.length,shipped:g,byCountry:r,lockedContracts:d,coaCoverage:a,totalRevenue:x}},[s,n,v]);return e.jsxs("div",{className:"flex flex-col gap-4 h-full",children:[s.length>0&&e.jsxs("div",{className:"grid grid-cols-2 gap-3 sm:grid-cols-4",children:[e.jsxs("div",{className:"rounded-xl border bg-card p-4 flex items-center gap-3",children:[e.jsx("div",{className:"rounded-lg bg-blue-50 p-2",children:e.jsx(_e,{className:"h-5 w-5 text-blue-600"})}),e.jsxs("div",{children:[e.jsx("div",{className:"text-2xl font-bold",children:k.activeOrders}),e.jsx("div",{className:"text-xs text-muted-foreground",children:"Commandes actives"}),k.byCountry.length>0&&e.jsx("div",{className:"text-xs text-muted-foreground mt-0.5",children:k.byCountry.slice(0,2).map(([t,g])=>`${ge[t]??t} ${(g/1e3).toFixed(1)}t`).join(" · ")})]})]}),e.jsxs("div",{className:"rounded-xl border bg-card p-4 flex items-center gap-3",children:[e.jsx("div",{className:"rounded-lg bg-purple-50 p-2",children:e.jsx(qe,{className:"h-5 w-5 text-purple-600"})}),e.jsxs("div",{children:[e.jsx("div",{className:"text-2xl font-bold",children:k.shipped}),e.jsx("div",{className:"text-xs text-muted-foreground",children:"Expédiées / terminées"}),e.jsxs("div",{className:"text-xs text-muted-foreground mt-0.5",children:["sur ",s.length," total"]})]})]}),e.jsxs("div",{className:"rounded-xl border bg-card p-4 flex items-center gap-3",children:[e.jsx("div",{className:"rounded-lg bg-emerald-50 p-2",children:e.jsx(lt,{className:"h-5 w-5 text-emerald-600"})}),e.jsxs("div",{children:[e.jsx("div",{className:"text-2xl font-bold",children:k.lockedContracts}),e.jsx("div",{className:"text-xs text-muted-foreground",children:"Contrats verrouillés"}),e.jsxs("div",{className:"text-xs text-muted-foreground mt-0.5",children:["sur ",n.length," générés"]})]})]}),e.jsxs("div",{className:"rounded-xl border bg-card p-4 flex items-center gap-3",children:[e.jsx("div",{className:"rounded-lg bg-amber-50 p-2",children:e.jsx(Be,{className:"h-5 w-5 text-amber-600"})}),e.jsxs("div",{children:[e.jsxs("div",{className:"text-2xl font-bold",children:[k.coaCoverage,"%"]}),e.jsx("div",{className:"text-xs text-muted-foreground",children:"COA couverts"}),e.jsxs("div",{className:"text-xs text-muted-foreground mt-0.5",children:[v.length," COA créés"]})]})]})]}),e.jsxs("div",{className:"flex items-center gap-3 flex-wrap",children:[e.jsxs("div",{className:"relative flex-1 min-w-48",children:[e.jsx(Ge,{className:"absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"}),e.jsx(h,{className:"pl-9 h-9",placeholder:"Rechercher commande, client, COA...",value:b,onChange:t=>E(t.target.value)})]}),e.jsxs(f,{onClick:()=>{M(null),D(!0)},className:"gap-2 h-9",children:[e.jsx(ae,{className:"h-4 w-4"})," Nouvelle commande"]}),e.jsxs(f,{variant:"outline",onClick:()=>{G(null),R(!0)},className:"gap-2 h-9",children:[e.jsx(De,{className:"h-4 w-4"})," Nouveau COA"]})]}),e.jsxs(He,{defaultValue:"orders",className:"flex-1",children:[e.jsxs(Ve,{className:"mb-4",children:[e.jsxs(me,{value:"orders",children:["Commandes Export",e.jsx(X,{variant:"secondary",className:"ml-2 text-xs",children:s.length})]}),e.jsxs(me,{value:"contracts",children:["Contrats",e.jsx(X,{variant:"secondary",className:"ml-2 text-xs",children:n.length})]}),e.jsxs(me,{value:"coa",children:["COA",e.jsx(X,{variant:"secondary",className:"ml-2 text-xs",children:v.length})]})]}),e.jsx(xe,{value:"orders",children:m?e.jsx("div",{className:"flex items-center justify-center py-16",children:e.jsx("div",{className:"h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary"})}):z.length===0?e.jsxs("div",{className:"flex flex-col items-center justify-center py-16 text-muted-foreground gap-3",children:[e.jsx(_e,{className:"h-10 w-10 opacity-30"}),e.jsx("p",{className:"text-sm",children:b?"Aucun résultat":"Aucune commande export créée"}),!b&&e.jsxs(f,{variant:"outline",size:"sm",onClick:()=>{M(null),D(!0)},className:"gap-2",children:[e.jsx(ae,{className:"h-4 w-4"})," Créer la première"]})]}):e.jsx("div",{className:"overflow-x-auto rounded-xl border bg-card",children:e.jsxs("table",{className:"w-full text-sm",children:[e.jsx("thead",{children:e.jsxs("tr",{className:"border-b bg-muted/40 text-xs text-muted-foreground uppercase",children:[e.jsx("th",{className:"text-left px-4 py-2.5 font-medium",children:"Référence"}),e.jsx("th",{className:"text-left px-4 py-2.5 font-medium",children:"Client"}),e.jsx("th",{className:"text-left px-4 py-2.5 font-medium",children:"Pays"}),e.jsx("th",{className:"text-left px-4 py-2.5 font-medium",children:"Langue"}),e.jsx("th",{className:"text-right px-4 py-2.5 font-medium",children:"Poids (kg)"}),e.jsx("th",{className:"text-right px-4 py-2.5 font-medium",children:"Montant"}),e.jsx("th",{className:"text-left px-4 py-2.5 font-medium",children:"Statut"}),e.jsx("th",{className:"text-right px-4 py-2.5 font-medium",children:"Actions"})]})}),e.jsx("tbody",{children:z.map(t=>{var d,a;const g=Re[t.status]??Re.draft,r=n.some(x=>x.order_id===t.id);return e.jsxs("tr",{className:"border-b last:border-0 hover:bg-muted/20 transition-colors",children:[e.jsx("td",{className:"px-4 py-2.5 font-mono font-medium text-primary",children:t.order_ref}),e.jsx("td",{className:"px-4 py-2.5 font-medium",children:t.customer_name}),e.jsx("td",{className:"px-4 py-2.5",children:ge[t.customer_country]??t.customer_country}),e.jsx("td",{className:"px-4 py-2.5",children:e.jsx(X,{variant:"outline",className:"text-xs",children:Ee[t.contract_language]??t.contract_language})}),e.jsx("td",{className:"px-4 py-2.5 text-right",children:(d=t.total_weight_kg)==null?void 0:d.toLocaleString("fr-FR",{minimumFractionDigits:0})}),e.jsxs("td",{className:"px-4 py-2.5 text-right font-semibold",children:[(a=t.total_amount)==null?void 0:a.toLocaleString("fr-FR",{minimumFractionDigits:2})," ",t.currency]}),e.jsx("td",{className:"px-4 py-2.5",children:e.jsx(X,{variant:"outline",className:re("text-xs",g.cls),children:g.label})}),e.jsx("td",{className:"px-4 py-2.5",children:e.jsxs("div",{className:"flex justify-end gap-1",children:[se[t.status]&&e.jsxs(f,{variant:"ghost",size:"sm",className:re("h-9 px-2.5 text-xs gap-1",se[t.status].cls),onClick:()=>_.mutateAsync({id:t.id,status:se[t.status].status}),disabled:_.isPending,title:se[t.status].label,children:[e.jsx(Ye,{className:"h-3 w-3"}),se[t.status].label]}),!r&&e.jsxs(f,{variant:"ghost",size:"sm",className:"h-9 px-2 text-xs gap-1",onClick:()=>I(t),disabled:N.isPending,title:"Générer contrat",children:[e.jsx(he,{className:"h-3.5 w-3.5"})," Contrat"]}),e.jsx(f,{variant:"ghost",size:"sm",className:"h-9 w-9 p-0",onClick:()=>{M(t),D(!0)},title:"Modifier",children:e.jsx(Fe,{className:"h-3.5 w-3.5"})}),e.jsx(f,{variant:"ghost",size:"sm",className:"h-9 w-9 p-0 text-destructive hover:text-destructive",onClick:()=>q(t),title:"Supprimer",children:e.jsx(fe,{className:"h-3.5 w-3.5"})})]})})]},t.id)})})]})})}),e.jsx(xe,{value:"contracts",children:i?e.jsx("div",{className:"flex items-center justify-center py-16",children:e.jsx("div",{className:"h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary"})}):n.length===0?e.jsxs("div",{className:"flex flex-col items-center justify-center py-16 text-muted-foreground gap-3",children:[e.jsx(he,{className:"h-10 w-10 opacity-30"}),e.jsx("p",{className:"text-sm",children:"Aucun contrat généré — créez une commande export d'abord"})]}):e.jsx("div",{className:"overflow-x-auto rounded-xl border bg-card",children:e.jsxs("table",{className:"w-full text-sm",children:[e.jsx("thead",{children:e.jsxs("tr",{className:"border-b bg-muted/40 text-xs text-muted-foreground uppercase",children:[e.jsx("th",{className:"text-left px-4 py-2.5 font-medium",children:"Contrat"}),e.jsx("th",{className:"text-left px-4 py-2.5 font-medium",children:"Commande"}),e.jsx("th",{className:"text-left px-4 py-2.5 font-medium",children:"Pays / Langue"}),e.jsx("th",{className:"text-left px-4 py-2.5 font-medium",children:"Version"}),e.jsx("th",{className:"text-left px-4 py-2.5 font-medium",children:"Statut"}),e.jsx("th",{className:"text-left px-4 py-2.5 font-medium",children:"Historique"}),e.jsx("th",{className:"text-right px-4 py-2.5 font-medium",children:"Actions"})]})}),e.jsx("tbody",{children:n.map(t=>{const g=s.find(x=>x.id===t.order_id),r=Oe[t.status]??Oe.draft,d=r.icon,a=t.status==="locked";return e.jsxs("tr",{className:"border-b last:border-0 hover:bg-muted/20 transition-colors",children:[e.jsx("td",{className:"px-4 py-2.5 font-mono font-medium text-primary",children:t.contract_ref}),e.jsx("td",{className:"px-4 py-2.5 text-muted-foreground",children:t.order_ref}),e.jsxs("td",{className:"px-4 py-2.5",children:[e.jsx("span",{children:ge[t.buyer_country]??t.buyer_country}),e.jsx(X,{variant:"outline",className:"ml-2 text-xs",children:Ee[t.language]??t.language})]}),e.jsx("td",{className:"px-4 py-2.5",children:e.jsxs(X,{variant:"outline",className:"font-mono text-xs",children:["v",t.current_version]})}),e.jsx("td",{className:"px-4 py-2.5",children:e.jsxs(X,{variant:"outline",className:re("gap-1 text-xs",r.cls),children:[e.jsx(d,{className:"h-3 w-3"})," ",r.label]})}),e.jsx("td",{className:"px-4 py-2.5 text-xs text-muted-foreground",children:t.version_history.length>0?`${t.version_history.length} version(s) archivée(s)`:"—"}),e.jsx("td",{className:"px-4 py-2.5",children:e.jsxs("div",{className:"flex justify-end gap-1",children:[e.jsx(f,{variant:"ghost",size:"sm",className:"h-9 w-9 p-0",onClick:()=>g&&vt(g,t),title:"Imprimer",children:e.jsx($e,{className:"h-3.5 w-3.5"})}),!a&&e.jsx(f,{variant:"ghost",size:"sm",className:"h-9 w-9 p-0 text-emerald-600",onClick:()=>H(t),title:"Approuver & Verrouiller",children:e.jsx(ve,{className:"h-3.5 w-3.5"})}),a&&e.jsx(f,{variant:"ghost",size:"sm",className:"h-9 w-9 p-0 text-blue-600",onClick:()=>V(t),title:"Régénérer (nouvelle version)",children:e.jsx(Le,{className:"h-3.5 w-3.5"})})]})})]},t.id)})})]})})}),e.jsx(xe,{value:"coa",children:j?e.jsx("div",{className:"flex items-center justify-center py-16",children:e.jsx("div",{className:"h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary"})}):Y.length===0?e.jsxs("div",{className:"flex flex-col items-center justify-center py-16 text-muted-foreground gap-3",children:[e.jsx(De,{className:"h-10 w-10 opacity-30"}),e.jsx("p",{className:"text-sm",children:b?"Aucun résultat":"Aucun COA créé"}),!b&&e.jsxs(f,{variant:"outline",size:"sm",onClick:()=>{G(null),R(!0)},className:"gap-2",children:[e.jsx(ae,{className:"h-4 w-4"})," Créer le premier COA"]})]}):e.jsx("div",{className:"overflow-x-auto rounded-xl border bg-card",children:e.jsxs("table",{className:"w-full text-sm",children:[e.jsx("thead",{children:e.jsxs("tr",{className:"border-b bg-muted/40 text-xs text-muted-foreground uppercase",children:[e.jsx("th",{className:"text-left px-4 py-2.5 font-medium",children:"Réf. COA"}),e.jsx("th",{className:"text-left px-4 py-2.5 font-medium",children:"Lot"}),e.jsx("th",{className:"text-left px-4 py-2.5 font-medium",children:"Fournisseur"}),e.jsx("th",{className:"text-left px-4 py-2.5 font-medium",children:"Grade"}),e.jsx("th",{className:"text-left px-4 py-2.5 font-medium",children:"Humidité"}),e.jsx("th",{className:"text-left px-4 py-2.5 font-medium",children:"Expiration"}),e.jsx("th",{className:"text-left px-4 py-2.5 font-medium",children:"Approuvé par"}),e.jsx("th",{className:"text-right px-4 py-2.5 font-medium",children:"Actions"})]})}),e.jsx("tbody",{children:Y.map(t=>{const g=t.humidity_pct!=null&&t.humidity_pct>=14&&t.humidity_pct<=18;return e.jsxs("tr",{className:"border-b last:border-0 hover:bg-muted/20 transition-colors",children:[e.jsx("td",{className:"px-4 py-2.5 font-mono font-medium text-primary",children:t.coa_ref}),e.jsx("td",{className:"px-4 py-2.5 font-mono text-muted-foreground",children:t.batch_ref??"—"}),e.jsx("td",{className:"px-4 py-2.5",children:t.supplier_name??"—"}),e.jsx("td",{className:"px-4 py-2.5",children:t.visual_grade?e.jsx(X,{variant:"outline",className:re("text-xs",{"bg-emerald-50 text-emerald-800 border-emerald-200":t.visual_grade==="premium","bg-blue-50 text-blue-800 border-blue-200":t.visual_grade==="standard","bg-amber-50 text-amber-800 border-amber-200":t.visual_grade==="economy","bg-red-50 text-red-700 border-red-200":t.visual_grade==="rejected"}),children:t.visual_grade}):"—"}),e.jsx("td",{className:"px-4 py-2.5",children:t.humidity_pct!=null?e.jsxs("span",{className:g?"text-emerald-700 font-medium":"text-red-600 font-medium",children:[t.humidity_pct,"%"]}):"—"}),e.jsx("td",{className:"px-4 py-2.5 text-muted-foreground",children:t.expiry_date??"—"}),e.jsx("td",{className:"px-4 py-2.5",children:t.approved_by?e.jsxs("span",{className:"flex items-center gap-1 text-emerald-700 text-xs",children:[e.jsx(Te,{className:"h-3.5 w-3.5"})," ",t.approved_by]}):e.jsx("span",{className:"text-muted-foreground text-xs",children:"En attente"})}),e.jsx("td",{className:"px-4 py-2.5",children:e.jsxs("div",{className:"flex justify-end gap-1",children:[e.jsx(f,{variant:"ghost",size:"sm",className:"h-9 w-9 p-0",onClick:()=>_t(t),title:"Imprimer COA",children:e.jsx($e,{className:"h-3.5 w-3.5"})}),e.jsx(f,{variant:"ghost",size:"sm",className:"h-9 w-9 p-0",onClick:()=>{G(t),R(!0)},title:"Modifier",children:e.jsx(Fe,{className:"h-3.5 w-3.5"})}),e.jsx(f,{variant:"ghost",size:"sm",className:"h-9 w-9 p-0 text-destructive hover:text-destructive",onClick:()=>T(t),title:"Supprimer",children:e.jsx(fe,{className:"h-3.5 w-3.5"})})]})})]},t.id)})})]})})})]}),e.jsx(xt,{open:U,onOpenChange:D,initial:u,onSubmit:ee,isSaving:y.isPending||_.isPending}),e.jsx(pt,{open:W,onOpenChange:R,initial:B,onSubmit:te,isSaving:S.isPending||w.isPending}),O&&e.jsx(yt,{contract:O,order:s.find(t=>t.id===O.order_id),open:!!O,onOpenChange:t=>!t&&H(null)}),L&&e.jsx(jt,{contract:L,open:!!L,onOpenChange:t=>!t&&V(null)}),e.jsx(ye,{open:!!C,onOpenChange:t=>!t&&q(null),children:e.jsxs(je,{children:[e.jsxs(be,{children:[e.jsx(Ne,{children:"Supprimer cette commande ?"}),e.jsxs(Ce,{children:[C==null?void 0:C.order_ref," — ",C==null?void 0:C.customer_name,". Action irréversible."]})]}),e.jsxs(Ae,{children:[e.jsx(Se,{children:"Annuler"}),e.jsx(we,{className:"bg-destructive text-destructive-foreground hover:bg-destructive/90",onClick:async()=>{C&&(await $.mutateAsync(C.id),q(null))},children:"Supprimer"})]})]})}),e.jsx(ye,{open:!!A,onOpenChange:t=>!t&&T(null),children:e.jsxs(je,{children:[e.jsxs(be,{children:[e.jsx(Ne,{children:"Supprimer ce COA ?"}),e.jsxs(Ce,{children:[A==null?void 0:A.coa_ref," — Lot ",A==null?void 0:A.batch_ref,". Action irréversible."]})]}),e.jsxs(Ae,{children:[e.jsx(Se,{children:"Annuler"}),e.jsx(we,{className:"bg-destructive text-destructive-foreground hover:bg-destructive/90",onClick:async()=>{A&&(await P.mutateAsync(A.id),T(null))},children:"Supprimer"})]})]})})]})}export{kt as ExportDashboard};
