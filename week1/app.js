let dataset = null;
let charts = {};

function loadFile() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];

    if (!file) {
        alert('Please select a CSV file first.');
        return;
    }

    document.getElementById('fileInfo').innerHTML = '<div class="loading">Processing file...</div>';

    Papa.parse(file, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: function(results) {
            dataset = results.data;
            document.getElementById('fileInfo').innerHTML = `<p>Loaded ${dataset.length} records with ${Object.keys(dataset[0]).length} features each.</p>`;
            document.getElementById('analysisContent').style.display = 'block';
            performAnalysis();
        },
        error: function(error) {
            document.getElementById('fileInfo').innerHTML = `<p>Error: ${error.message}</p>`;
        }
    });
}

function performAnalysis() {
    preprocessData();
    generateOverview();
    analyzeMissingValues();
    generateStatsSummary();
    analyzeFeatureImportance();
    createVisualizations();
}

function preprocessData() {
    dataset.forEach(passenger => {
        if (passenger.Age === null || isNaN(passenger.Age)) {
            passenger.Age = calculateMedian(dataset.map(p => p.Age).filter(a => !isNaN(a) && a !== null));
        }
        if (!passenger.Embarked) passenger.Embarked = 'S';
        const nameParts = passenger.Name.split(', ');
        if (nameParts.length > 1) {
            const titlePart = nameParts[1].split('. ');
            passenger.Title = titlePart[0];
        } else passenger.Title = 'Unknown';

        const commonTitles = ['Mr','Miss','Mrs','Master'];
        if (!commonTitles.includes(passenger.Title)) passenger.Title='Other';

        passenger.FamilySize = passenger.SibSp + passenger.Parch + 1;
        passenger.IsAlone = passenger.FamilySize === 1 ? 1 : 0;
    });
}

function calculateMedian(values) {
    if(values.length===0) return 0;
    values.sort((a,b)=>a-b);
    const half=Math.floor(values.length/2);
    return values.length%2===0 ? (values[half-1]+values[half])/2 : values[half];
}

function generateOverview() {
    const total = dataset.length;
    const survived = dataset.filter(p=>p.Survived===1).length;
    const overviewContent = `
        <p><strong>Total Passengers:</strong> ${total}</p>
        <p><strong>Survived:</strong> ${survived} (${(survived/total*100).toFixed(2)}%)</p>
        <p><strong>Perished:</strong> ${total-survived} (${(100-survived/total*100).toFixed(2)}%)</p>
        <p><strong>Features:</strong> ${Object.keys(dataset[0]).join(', ')}</p>
    `;
    document.getElementById('overviewContent').innerHTML = overviewContent;
}

function analyzeMissingValues() {
    const features = Object.keys(dataset[0]);
    let html = '<table><tr><th>Feature</th><th>Missing Values</th><th>Percentage</th></tr>';
    features.forEach(f=>{
        const missing = dataset.filter(p=>p[f]===null||p[f]===undefined||p[f]==='').length;
        html += `<tr><td>${f}</td><td>${missing}</td><td>${(missing/dataset.length*100).toFixed(2)}%</td></tr>`;
    });
    html+='</table>';
    document.getElementById('missingValuesContent').innerHTML = html;
}

function generateStatsSummary() {
    const numericFeatures = ['Age','SibSp','Parch','Fare','FamilySize'];
    let html = '<table><tr><th>Feature</th><th>Mean</th><th>Median</th><th>Min</th><th>Max</th></tr>';
    numericFeatures.forEach(f=>{
        const vals = dataset.map(p=>p[f]).filter(v=>!isNaN(v)&&v!==null);
        const mean = (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(2);
        const median = calculateMedian(vals).toFixed(2);
        const min = Math.min(...vals).toFixed(2);
        const max = Math.max(...vals).toFixed(2);
        html+=`<tr><td>${f}</td><td>${mean}</td><td>${median}</td><td>${min}</td><td>${max}</td></tr>`;
    });
    html+='</table>';
    document.getElementById('statsSummaryContent').innerHTML = html;
}

function analyzeFeatureImportance() {
    const categoricalFeatures=['Pclass','Sex','Embarked','Title','IsAlone'];
    const categoricalResults={};
    categoricalFeatures.forEach(f=>{
        const categories = [...new Set(dataset.map(p=>p[f]))];
        const obj={};
        categories.forEach(c=>{
            const pass = dataset.filter(p=>p[f]===c);
            const surv = pass.filter(p=>p.Survived===1).length;
            obj[c] = { rate: surv/pass.length*100, total: pass.length };
        });
        categoricalResults[f]=obj;
    });

    const numericFeatures=['Age','Fare','FamilySize','SibSp','Parch'];
    const numericResults={};
    numericFeatures.forEach(f=>{
        const survived = dataset.filter(p=>p.Survived===1).map(p=>p[f]);
        const all = dataset.map(p=>p[f]);
        numericResults[f]={ survived, all };
    });

    createCategoricalChart(categoricalResults);
    createNumericChart(numericResults);
    calculateCorrelations();
    determineMostImportantFactor(categoricalResults,numericResults);
}

function createVisualizations() {
    createPclassChart();
    createGenderChart();
    createAgeChart();
    createEmbarkedChart();
}

// ---------- Charts Functions ----------
function createCategoricalChart(results){
    const features=Object.keys(results);
    const ranges=features.map(f=>{
        const rates=Object.values(results[f]).map(v=>v.rate);
        return Math.max(...rates)-Math.min(...rates);
    });
    const ctx=document.getElementById('categoricalChart').getContext('2d');
    if(charts.categoricalChart) charts.categoricalChart.destroy();
    charts.categoricalChart=new Chart(ctx,{ type:'bar', data:{ labels:features, datasets:[{ label:'Survival Rate Range (%)', data:ranges, backgroundColor:'rgba(54,162,235,0.7)' }] }, options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{ beginAtZero:true, title:{display:true,text:'Survival Rate Range (%)'} } }, plugins:{ title:{ display:true,text:'Impact of Categorical Features on Survival' } } } });
}

function createNumericChart(results){
    const features=Object.keys(results);
    const diffs=features.map(f=>{
        const survMean=results[f].survived.reduce((a,b)=>a+b,0)/results[f].survived.length;
        const allMean=results[f].all.reduce((a,b)=>a+b,0)/results[f].all.length;
        return Math.abs(survMean-allMean);
    });
    const ctx=document.getElementById('numericChart').getContext('2d');
    if(charts.numericChart) charts.numericChart.destroy();
    charts.numericChart=new Chart(ctx,{ type:'bar', data:{ labels:features, datasets:[{ label:'Difference from Mean', data:diffs, backgroundColor:'rgba(255,99,132,0.7)' }] }, options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{ beginAtZero:true, title:{display:true,text:'Difference from Mean'} } }, plugins:{ title:{ display:true,text:'Impact of Numeric Features on Survival' } } } });
}

function calculateCorrelations(){
    const numeric=['Age','Fare','SibSp','Parch','FamilySize'];
    const corr={};
    numeric.forEach(f=>{
        const x=dataset.map(p=>p[f]); const y=dataset.map(p=>p.Survived);
        const xM=x.reduce((a,b)=>a+b,0)/x.length; const yM=y.reduce((a,b)=>a+b,0)/y.length;
        let num=0,dx=0,dy=0;
        for(let i=0;i<x.length;i++){ num+=(x[i]-xM)*(y[i]-yM); dx+=Math.pow(x[i]-xM,2); dy+=Math.pow(y[i]-yM,2); }
        corr[f]=dx&&dy?num/Math.sqrt(dx*dy):0;
    });
    const ctx=document.getElementById('correlationChart').getContext('2d');
    if(charts.correlationChart) charts.correlationChart.destroy();
    charts.correlationChart=new Chart(ctx,{ type:'bar', data:{ labels:Object.keys(corr), datasets:[{ label:'Correlation with Survival', data:Object.values(corr), backgroundColor:Object.values(corr).map(c=>c>0?'rgba(75,192,192,0.7)':'rgba(255,99,132,0.7)') }] }, options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{ min:-1, max:1, title:{display:true,text:'Correlation Coefficient'} } }, plugins:{ title:{ display:true,text:'Correlation Between Numeric Features and Survival' } } } });
}

function createPclassChart(){
    const data=[1,2,3].map(c=>{ const p=dataset.filter(p=>p.Pclass==c); return { survived:p.filter(p=>p.Survived==1).length, perished:p.filter(p=>p.Survived==0).length }; });
    const ctx=document.getElementById('pclassChart').getContext('2d');
    if(charts.pclassChart) charts.pclassChart.destroy();
    charts.pclassChart=new Chart(ctx,{ type:'bar', data:{ labels:['1st Class','2nd Class','3rd Class'], datasets:[ { label:'Survived', data:data.map(d=>d.survived), backgroundColor:'rgba(75,192,192,0.7)' }, { label:'Perished', data:data.map(d=>d.perished), backgroundColor:'rgba(255,99,132,0.7)' } ] }, options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{ beginAtZero:true, title:{display:true,text:'Passenger Count'} } }, plugins:{ title:{ display:true,text:'Survival by Passenger Class' } } } });
}

function createGenderChart(){
    const male=dataset.filter(p=>p.Sex=='male'), female=dataset.filter(p=>p.Sex=='female');
    const ctx=document.getElementById('genderChart').getContext('2d');
    if(charts.genderChart) charts.genderChart.destroy();
    charts.genderChart=new Chart(ctx,{ type:'doughnut', data:{ labels:['Female Survived','Female Perished','Male Survived','Male Perished'], datasets:[{ data:[female.filter(p=>p.Survived==1).length,female.filter(p=>p.Survived==0).length,male.filter(p=>p.Survived==1).length,male.filter(p=>p.Survived==0).length], backgroundColor:['rgba(75,192,192,0.7)','rgba(255,99,132,0.7)','rgba(54,162,235,0.7)','rgba(255,159,64,0.7)'] }] }, options:{ responsive:true, maintainAspectRatio:false, plugins:{ title:{ display:true,text:'Survival by Gender' }, legend:{ position:'bottom' } } } });
}

function createAgeChart(){
    const binsCount=10;
    const survived=dataset.filter(p=>p.Survived==1).map(p=>p.Age);
    const perished=dataset.filter(p=>p.Survived==0).map(p=>p.Age);
    const survivedBins=getBins(survived,binsCount), perishedBins=getBins(perished,binsCount);
    const minAge=Math.min(...dataset.map(p=>p.Age)), maxAge=Math.max(...dataset.map(p=>p.Age));
    const labels=Array.from({length:binsCount},(_,i)=>`${(minAge+i*(maxAge-minAge)/binsCount).toFixed(1)}-${(minAge+(i+1)*(maxAge-minAge)/binsCount).toFixed(1)}`);
    const ctx=document.getElementById('ageChart').getContext('2d');
    if(charts.ageChart) charts.ageChart.destroy();
    charts.ageChart=new Chart(ctx,{ type:'bar', data:{ labels:labels, datasets:[ { label:'Survived', data:survivedBins, backgroundColor:'rgba(75,192,192,0.5)' }, { label:'Perished', data:perishedBins, backgroundColor:'rgba(255,99,132,0.5)' } ] }, options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{ beginAtZero:true, title:{display:true,text:'Count'} } }, plugins:{ title:{ display:true,text:'Age Distribution by Survival' } } } });
}

function createEmbarkedChart(){
    const ports=['C','Q','S'];
    const data=ports.map(p=>{
        const pass=dataset.filter(d=>d.Embarked==p);
        const surv=pass.filter(d=>d.Survived==1).length;
        return pass.length ? (surv/pass.length*100).toFixed(2) : 0;
    });
    const ctx=document.getElementById('embarkedChart').getContext('2d');
    if(charts.embarkedChart) charts.embarkedChart.destroy();
    charts.embarkedChart=new Chart(ctx,{ type:'bar', data:{ labels:['Cherbourg','Queenstown','Southampton'], datasets:[{ label:'Survival Rate (%)', data:data, backgroundColor:'rgba(153,102,255,0.7)' }] }, options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{ beginAtZero:true, max:100, title:{display:true,text:'Survival Rate (%)'} } }, plugins:{ title:{ display:true,text:'Survival Rate by Embarkation Port' } } } });
}

// --- Helper function ---
function getBins(values,binsCount){
    const min=Math.min(...values), max=Math.max(...values);
    const bins=Array(binsCount).fill(0), step=(max-min)/binsCount;
    values.forEach(v=>{ let idx=Math.floor((v-min)/step); if(idx===binsCount) idx=binsCount-1; bins[idx]++; });
    return bins;
}

// --- Determine Most Important Factor ---
function determineMostImportantFactor(catResults,numResults){
    let maxImpact=0, factor='', details='';
    const genderImpact=Math.abs(catResults['Sex']['male'].rate-catResults['Sex']['female'].rate);
    if(genderImpact>maxImpact){ maxImpact=genderImpact; factor='Gender'; details=`Female: ${catResults['Sex']['female'].rate.toFixed(2)}%, Male: ${catResults['Sex']['male'].rate.toFixed(2)}%`; }
    const pclassValues=Object.values(catResults['Pclass']);
    const pclassImpact=Math.max(...pclassValues.map(v=>v.rate))-Math.min(...pclassValues.map(v=>v.rate));
    if(pclassImpact>maxImpact){ maxImpact=pclassImpact; factor='Passenger Class'; details=`1st class: ${catResults['Pclass']['1'].rate.toFixed(2)}%, 3rd class: ${catResults['Pclass']['3'].rate.toFixed(2)}%`; }
    document.getElementById('keyFinding').innerHTML=`<p>The most important factor contributing to passenger death was <strong>${factor}</strong>.</p><p>${details}</p>`;
}
