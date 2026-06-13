import{g as e,p as t,t as n}from"./jsx-runtime---aTA0Ve.js";import{n as r,p as i,r as a,t as o}from"./index-BZD1qZg7.js";import{a as s}from"./Skeleton-DfIkC8s6.js";import{g as c}from"./collegeAdminService-D0VWwsKM.js";import{t as l}from"./usePayU-CkV-zpTP.js";var u=e(t(),1);function d(e,t,n=`asc`,r={}){let{searchFields:i=[],numericCols:a=[]}=r,[o,s]=(0,u.useState)(t),[c,l]=(0,u.useState)(n),[d,f]=(0,u.useState)(``);function p(e){o===e?l(e=>e===`asc`?`desc`:`asc`):(s(e),l(`asc`))}return{sorted:(0,u.useMemo)(()=>{let t=e;if(i.length>0&&d.trim()){let e=d.trim().toLowerCase();t=t.filter(t=>i.some(n=>String(t[n]||``).toLowerCase().includes(e)))}return[...t].sort((e,t)=>{let n=e[o],r=t[o];n??=``,r??=``,a.includes(o)&&(n=Number(n),r=Number(r));let i=typeof n==`number`&&typeof r==`number`?n-r:String(n).localeCompare(String(r));return c===`asc`?i:-i})},[e,o,c,d]),query:d,setQuery:f,sortCol:o,sortDir:c,toggleSort:p}}function f(e,t,n={}){let{onPaid:r}=n,{redirectToPayU:s}=l(),d=i(),[f,p]=(0,u.useState)(null),[m,h]=(0,u.useState)(!0),[g,_]=(0,u.useState)(!1),[v,y]=(0,u.useState)(``),[b,x]=(0,u.useState)(``);function S(){h(!0),o(e).then(e=>p(e.data.data)).catch(()=>y(`Failed to load fee details.`)).finally(()=>h(!1))}(0,u.useEffect)(()=>{S()},[e]);async function C(t){if(!t||t<=0){y(`Invalid payment amount.`);return}y(``),x(``),_(!0);try{let{endpoint:n,fields:r}=(await a({application_id:e,payment_type:`college_fee`,amount:t})).data.data;s({endpoint:n,fields:r})}catch(e){let t=e?.response?.data?.message||`Could not initiate payment.`;y(t),d.error(t),_(!1)}}async function w(n,i={}){let{amount:a,note:o}=n;if(!a||a<=0)return y(`Enter a valid amount.`),!1;y(``),x(``),_(!0);try{let n=(await c(t,e,{amount:a,note:o?.trim()||void 0})).data.message;return d.success(n),x(n),S(),r?.(),i.onSuccess?.(n),!0}catch(e){let t=e?.response?.data?.message||`Failed to record payment.`;return y(t),d.error(t),!1}finally{_(!1)}}return{feeStatus:f,loading:m,paying:g,payError:v,paidMsg:b,fetchStatus:S,payOnline:C,payCash:w,setPayError:y,setPaidMsg:x}}var p=n(),m={application_fee:`Platform Fee`,college_fee:`College Fee`};function h(e){if(!e)return null;try{return new Date(e.toString().replace(` `,`T`).split(`.`)[0])}catch{return null}}function g(e){let t=h(e);return t?t.toLocaleDateString(`en-IN`,{day:`2-digit`,month:`short`,year:`numeric`,timeZone:`Asia/Kolkata`}):`—`}function _(e){let t=h(e);return t?t.toLocaleTimeString(`en-IN`,{hour:`2-digit`,minute:`2-digit`,hour12:!0,timeZone:`Asia/Kolkata`}):``}function v({applicationId:e,onClose:t,hideTypes:n=[],showOrderId:i=!1}){let[a,o]=(0,u.useState)(null),[c,l]=(0,u.useState)(!0),[d,f]=(0,u.useState)(``),[h,v]=(0,u.useState)(null);if((0,u.useEffect)(()=>{r(e).then(e=>{let t=e.data.data;o(t)}).catch(()=>f(`Failed to load receipts.`)).finally(()=>l(!1))},[e]),c)return(0,p.jsx)(`div`,{className:`py-4 px-2`,children:(0,p.jsx)(s,{rows:4})});if(d)return(0,p.jsx)(`div`,{className:`py-6 text-center text-red-500 text-sm`,children:d});let b=(a?.payments||[]).filter(e=>!n.includes(e.payment_type));return b.length?(0,p.jsxs)(`div`,{className:`space-y-2`,children:[t&&(0,p.jsxs)(`div`,{className:`flex items-center justify-between mb-1`,children:[(0,p.jsx)(`p`,{className:`text-sm font-bold text-slate-700`,children:`Payment Receipts`}),(0,p.jsx)(`button`,{onClick:t,className:`text-xs text-slate-400 hover:text-slate-600`,children:`✕ Close`})]}),b.map((e,t)=>(0,p.jsxs)(`div`,{className:`rounded-lg border border-slate-200 overflow-hidden`,children:[(0,p.jsxs)(`button`,{onClick:()=>v(h===e.id?null:e.id),className:`w-full flex items-center justify-between px-3 py-2.5 bg-white hover:bg-slate-50 transition text-left`,children:[(0,p.jsxs)(`div`,{className:`flex items-center gap-2.5`,children:[(0,p.jsx)(`div`,{className:`h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0`,children:(0,p.jsx)(`span`,{className:`text-emerald-700 text-xs font-bold`,children:t+1})}),(0,p.jsxs)(`div`,{children:[(0,p.jsx)(`p`,{className:`text-sm font-semibold text-slate-900 leading-tight`,children:m[e.payment_type]||e.payment_type}),(0,p.jsxs)(`p`,{className:`text-xs text-slate-400`,children:[g(e.completed_at),` `,_(e.completed_at)]})]})]}),(0,p.jsxs)(`div`,{className:`flex items-center gap-2 shrink-0`,children:[(0,p.jsxs)(`span`,{className:`text-sm font-bold text-slate-950`,children:[`₹`,Number(e.amount).toLocaleString(`en-IN`)]}),(0,p.jsx)(`span`,{className:`text-slate-300 text-xs`,children:h===e.id?`▲`:`▼`})]})]}),h===e.id&&(0,p.jsx)(y,{app:a.application,pmt:e,showOrderId:i})]},e.id))]}):(0,p.jsx)(`div`,{className:`py-6 text-center text-slate-400 text-sm`,children:`No payment receipts found.`})}function y({app:e,pmt:t,showOrderId:n=!1}){let r=`RCP-${String(t.id).padStart(6,`0`)}`,i=m[t.payment_type]||t.payment_type,a=(e.app_full_name||e.student_name||``).trim(),o=(0,u.useRef)(null);function s(n){let o=h(t.completed_at),s=o?`${String(o.getDate()).padStart(2,`0`)}/${String(o.getMonth()+1).padStart(2,`0`)}/${String(o.getFullYear()).slice(-2)}`:g(t.completed_at),c=`${{1:`FY`,2:`SY`,3:`TY`,4:`4Y`,5:`5Y`}[e.year_of_study]||``}${e.degree_course_code||``}${e.app_division?` - `+e.app_division:``}`,l=t.fee_heads||[],u=l.length?l.map((e,t)=>`
          <tr>
            <td style="border:1px solid #000;padding:3px 6px;text-align:center;font-size:11px;">${t+1}</td>
            <td style="border:1px solid #000;padding:3px 8px;font-size:11px;">${e.fees_head}</td>
            <td style="border:1px solid #000;padding:3px 8px;text-align:right;font-size:11px;">${Number(e.paid||e.amount).toFixed(2)}</td>
          </tr>`).join(``):`<tr>
          <td style="border:1px solid #000;padding:3px 6px;text-align:center;font-size:11px;">1</td>
          <td style="border:1px solid #000;padding:3px 8px;font-size:11px;">${i}</td>
          <td style="border:1px solid #000;padding:3px 8px;text-align:right;font-size:11px;">${Number(t.amount).toFixed(2)}</td>
        </tr>`,d=Number(t.amount).toFixed(2);return`
    <div style="width:48%;font-family:'Times New Roman',Times,serif;font-size:12px;color:#000;border:2px solid #000;padding:10px 12px;box-sizing:border-box;display:flex;flex-direction:column;">
      <div>
        <div style="text-align:right;font-size:10px;font-style:italic;margin-bottom:2px;">${n}</div>
        ${e.trust_name?`<div style="text-align:center;font-size:11px;">${e.trust_name}</div>`:``}
        <div style="text-align:center;font-size:13px;font-weight:bold;">${e.college_name||``}</div>
        ${e.college_address?`<div style="text-align:center;font-size:10.5px;">${e.college_address}${e.college_city?`, `+e.college_city:``}</div>`:``}
        ${e.college_affiliation?`<div style="text-align:center;font-size:10px;">(${e.college_affiliation})</div>`:``}

        <div style="margin-top:8px;display:flex;justify-content:space-between;font-size:11px;">
          <span>Receipt No.- <strong>${r}</strong></span>
          <span>Date &nbsp;- &nbsp;${s}</span>
          <span>Class &nbsp;- &nbsp;${c}</span>
        </div>
        <div style="margin-top:4px;font-size:11px;">
          Received from &nbsp;<strong>${a}</strong>
        </div>
      </div>

      <div style="flex:1;display:flex;flex-direction:column;margin-top:8px;">
        <table style="width:100%;height:100%;border-collapse:collapse;">
          <thead>
            <tr>
              <th style="border:1px solid #000;padding:3px 6px;font-size:11px;text-align:center;width:40px;">Sr. No.</th>
              <th style="border:1px solid #000;padding:3px 8px;font-size:11px;text-align:center;">Particular</th>
              <th style="border:1px solid #000;padding:3px 8px;font-size:11px;text-align:center;width:70px;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${u}
            
          <tr style="height:100%;">
            <td colspan="3" style="border:1px solid #000;border-top:none;"></td>
          </tr>
          </tbody>
        </table>
      </div>

      <div>
        <div style="margin-top:10px;display:flex;justify-content:space-between;font-size:11px;">
          <span>Total : <strong>₹ ${d}</strong></span>
          <span style="font-style:italic;font-size:10px;">${x(Number(t.amount))} Only</span>
        </div>
        <div style="margin-top:20px;display:flex;justify-content:space-between;font-size:11px;">
          <span>Student Signature</span>
          <span>Cashier / Accountant</span>
        </div>
      </div>
    </div>`}function c(){return`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Fee Receipt — ${r}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Times New Roman',Times,serif;background:#fff;color:#000;padding:20px}
    @media print{
      body{padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .no-print{display:none!important}
      @page{size:A4 landscape;margin:10mm 12mm}
    }
  </style>
</head>
<body>
  <div class="no-print" style="text-align:center;margin-bottom:12px;">
    <button onclick="window.print()" style="padding:8px 24px;font-size:14px;cursor:pointer;background:#1e293b;color:#fff;border:none;border-radius:6px;">Print / Save PDF</button>
  </div>
  <!-- align-items:stretch: both copies always same height.
       min-height fills the landscape page; excess rows overflow to page 2. -->
  <div style="display:flex;gap:4%;align-items:stretch;min-height:calc(210mm - 20mm);">
    ${s(`Office Copy`)}
    ${s(`Student's Copy`)}
  </div>
</body>
</html>`}function l(){let e=window.open(``,`_blank`,`width=860,height=900`);e.document.write(c()),e.document.close(),e.focus(),setTimeout(()=>{e.print(),e.close()},600)}let d=h(t.completed_at),f=d?`${String(d.getDate()).padStart(2,`0`)}/${String(d.getMonth()+1).padStart(2,`0`)}/${String(d.getFullYear()).slice(-2)}`:g(t.completed_at),_=`${{1:`FY`,2:`SY`,3:`TY`,4:`4Y`,5:`5Y`}[e.year_of_study]||``}${e.degree_course_code||``}${e.app_division?` - `+e.app_division:``}`,v=t.fee_heads||[],y=v.length?v:[{fees_head:i,paid:t.amount,amount:t.amount}];return(0,p.jsxs)(`div`,{className:`border-t border-slate-100`,children:[(0,p.jsx)(`div`,{className:`flex gap-2 px-3 py-2 bg-slate-50 border-b border-slate-100 justify-end`,children:(0,p.jsxs)(`button`,{onClick:l,className:`flex items-center gap-1.5 rounded-md bg-slate-900 text-white text-xs font-semibold px-3 py-1.5 hover:bg-slate-700 transition`,children:[(0,p.jsx)(`svg`,{className:`w-3 h-3`,fill:`none`,viewBox:`0 0 24 24`,stroke:`currentColor`,strokeWidth:`2`,children:(0,p.jsx)(`path`,{strokeLinecap:`round`,strokeLinejoin:`round`,d:`M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z`})}),`Print / Save PDF`]})}),(0,p.jsx)(`div`,{ref:o,className:`bg-white p-4`,style:{fontFamily:`'Times New Roman', Times, serif`,color:`#000`},children:(0,p.jsx)(b,{copyLabel:`Office Copy`,app:e,receiptNo:r,shortDate:f,classLabel:_,studentName:a,displayRows:y,fillerCount:0,pmt:t})})]})}function b({copyLabel:e,app:t,receiptNo:n,shortDate:r,classLabel:i,studentName:a,displayRows:o,fillerCount:s,pmt:c}){let l=`border border-black px-2 py-1 text-xs`;return(0,p.jsxs)(`div`,{className:`border border-black p-3 text-xs`,style:{fontFamily:`'Times New Roman', Times, serif`},children:[(0,p.jsx)(`div`,{className:`text-right italic text-xs mb-1`,children:e}),t.trust_name&&(0,p.jsx)(`div`,{className:`text-center text-xs`,children:t.trust_name}),(0,p.jsx)(`div`,{className:`text-center font-bold text-sm`,children:t.college_name}),(t.college_address||t.college_city)&&(0,p.jsx)(`div`,{className:`text-center text-xs`,children:[t.college_address,t.college_city].filter(Boolean).join(`, `)}),t.college_affiliation&&(0,p.jsxs)(`div`,{className:`text-center text-xs`,children:[`(`,t.college_affiliation,`)`]}),(0,p.jsxs)(`div`,{className:`flex justify-between mt-2 text-xs`,children:[(0,p.jsxs)(`span`,{children:[`Receipt No.- `,(0,p.jsx)(`strong`,{children:n})]}),(0,p.jsxs)(`span`,{children:[`Date \xA0- \xA0`,r]}),i&&(0,p.jsxs)(`span`,{children:[`Class \xA0- \xA0`,i]})]}),(0,p.jsxs)(`div`,{className:`mt-1 text-xs`,children:[`Received from \xA0`,(0,p.jsx)(`strong`,{children:a})]}),(0,p.jsxs)(`table`,{className:`w-full border-collapse mt-2`,style:{height:`100%`},children:[(0,p.jsx)(`thead`,{children:(0,p.jsxs)(`tr`,{children:[(0,p.jsx)(`th`,{className:`${l} text-center w-10`,children:`Sr. No.`}),(0,p.jsx)(`th`,{className:`${l} text-center`,children:`Particular`}),(0,p.jsx)(`th`,{className:`${l} text-center w-20`,children:`Amount`})]})}),(0,p.jsxs)(`tbody`,{children:[o.map((e,t)=>(0,p.jsxs)(`tr`,{children:[(0,p.jsx)(`td`,{className:`${l} text-center`,children:t+1}),(0,p.jsx)(`td`,{className:l,children:e.fees_head}),(0,p.jsx)(`td`,{className:`${l} text-right`,children:Number(e.paid??e.amount).toFixed(2)})]},t)),(0,p.jsx)(`tr`,{style:{height:`100%`},children:(0,p.jsx)(`td`,{colSpan:3,className:`border border-black border-t-0`})})]})]}),(0,p.jsxs)(`div`,{className:`flex justify-between mt-2 text-xs`,children:[(0,p.jsxs)(`span`,{children:[`Total : `,(0,p.jsxs)(`strong`,{children:[`₹ `,Number(c.amount).toFixed(2)]})]}),(0,p.jsxs)(`span`,{className:`italic`,children:[x(Number(c.amount)),` Only`]})]}),(0,p.jsxs)(`div`,{className:`flex justify-between mt-5 text-xs`,children:[(0,p.jsx)(`span`,{children:`Student Signature`}),(0,p.jsx)(`span`,{children:`Cashier / Accountant`})]})]})}function x(e){if(!e||isNaN(e))return`Zero Rupees`;let t=[``,`One`,`Two`,`Three`,`Four`,`Five`,`Six`,`Seven`,`Eight`,`Nine`,`Ten`,`Eleven`,`Twelve`,`Thirteen`,`Fourteen`,`Fifteen`,`Sixteen`,`Seventeen`,`Eighteen`,`Nineteen`],n=[``,``,`Twenty`,`Thirty`,`Forty`,`Fifty`,`Sixty`,`Seventy`,`Eighty`,`Ninety`];function r(e){return e===0?``:e<20?t[e]+` `:e<100?n[Math.floor(e/10)]+(e%10?` `+t[e%10]:``)+` `:e<1e3?t[Math.floor(e/100)]+` Hundred `+r(e%100):e<1e5?r(Math.floor(e/1e3))+`Thousand `+r(e%1e3):e<1e7?r(Math.floor(e/1e5))+`Lakh `+r(e%1e5):r(Math.floor(e/1e7))+`Crore `+r(e%1e7)}let i=Math.floor(e),a=Math.round((e-i)*100),o=r(i).trim()+` Rupees`;return a>0&&(o+=` and `+r(a).trim()+` Paise`),o}export{f as n,d as r,v as t};