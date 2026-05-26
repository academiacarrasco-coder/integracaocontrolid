import React from 'react';
import { useGymData } from '../hooks/useGymData';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line,
  Legend
} from 'recharts';
import { 
  BarChart3, 
  PieChart as PieChartIcon, 
  TrendingUp, 
  AlertCircle,
  Calendar,
  Users,
  UserPlus,
  Download,
  Printer,
  ChevronRight,
  Search,
  Filter,
  RefreshCcw
} from 'lucide-react';
import { format, subMonths, subDays, startOfMonth, endOfMonth, startOfDay, endOfDay, isWithinInterval, eachDayOfInterval, eachMonthOfInterval, differenceInDays, differenceInMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';

const COLORS = ['#f97316', '#ef4444', '#22c55e', '#3b82f6', '#a855f7'];

export default function Reports() {
  const { students, payments, classes, plans, attendance, accessLogs, loading } = useGymData();
  const [selectedComponents, setSelectedComponents] = React.useState({
    revenueChart: true,
    statusChart: true,
    classChart: true,
    instructorChart: true,
    overdueTable: true,
    summaryTable: true,
    classDetails: true,
    studentsPerClass: true,
    detailedPayments: true,
    attendanceList: true,
    corporateReport: true,
    registrationsChart: true
  });

  const [dateRange, setDateRange] = React.useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });

  const [closingStart, setClosingStart] = React.useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '00:00'
  });
  const [closingEnd, setClosingEnd] = React.useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    time: format(new Date(), 'HH:mm')
  });
  const [showClosingReport, setShowClosingReport] = React.useState(false);

  const [appliedDateRange, setAppliedDateRange] = React.useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });

  const handleApplyFilter = () => {
    setAppliedDateRange(dateRange);
  };

  const [selectedClasses, setSelectedClasses] = React.useState<string[]>([]);
  const [selectedInstructors, setSelectedInstructors] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (classes.length > 0) {
      setSelectedClasses(classes.map(c => c.id));
      setSelectedInstructors(Array.from(new Set(classes.map(c => c.instructor).filter(Boolean))));
    }
  }, [classes]);

  if (loading) return <div>Carregando...</div>;

  // 0. Filtered Data Sets
  const filteredClassesData = classes.filter(c => selectedClasses.includes(c.id));
  const filteredInstructorsList = Array.from(new Set(filteredClassesData.map(c => c.instructor).filter(Boolean)));
  
  // Get students that are in the selected classes
  const filteredStudents = students.filter(s => 
    classes.some(c => selectedClasses.includes(c.id) && c.studentIds?.includes(s.id))
  );

  // Get payments from those students within the applied date range
  const filteredPayments = payments.filter(p => {
    const dateVal = p.date;
    const pDate = dateVal?.toDate ? dateVal.toDate() : new Date(dateVal);
    if (isNaN(pDate.getTime())) return false;
    const inRange = isWithinInterval(pDate, { 
      start: startOfDay(new Date(appliedDateRange.start)), 
      end: endOfDay(new Date(appliedDateRange.end)) 
    });
    return inRange && filteredStudents.some(s => s.id === p.studentId);
  });

  // 1. Active vs Inactive (Filtered)
  const activeCount = filteredStudents.filter(s => s.status === 'active').length;
  const inactiveCount = filteredStudents.filter(s => s.status === 'inactive').length;
  const statusData = [
    { name: 'Ativos', value: activeCount },
    { name: 'Inativos', value: inactiveCount }
  ];

  // 2. Revenue by Month (Dynamic based on appliedDateRange)
  const monthsInInterval = eachMonthOfInterval({
    start: startOfMonth(new Date(appliedDateRange.start)),
    end: endOfMonth(new Date(appliedDateRange.end))
  });

  // Limit to last 12 months if interval is too large
  const monthsToRender = monthsInInterval.length > 12 
    ? monthsInInterval.slice(-12) 
    : monthsInInterval;

  const revenueData = monthsToRender.map(monthDate => {
    const start = startOfMonth(monthDate);
    const end = endOfMonth(monthDate);
    
    const monthPayments = filteredPayments.filter(p => {
      const dateVal = p.date;
      const pDate = dateVal?.toDate ? dateVal.toDate() : new Date(dateVal);
      return isWithinInterval(pDate, { start, end }) && p.status === 'paid';
    });

    const breakdown = monthPayments.reduce((acc, p) => {
      const method = p.method || 'outro';
      acc[method] = (acc[method] || 0) + p.amount;
      return acc;
    }, {} as Record<string, number>);

    const monthRevenue = monthPayments.reduce((acc, p) => ({
      gross: acc.gross + p.amount,
      net: acc.net + (p.netAmount || p.amount)
    }), { gross: 0, net: 0 });

    return {
      name: format(monthDate, 'MMM', { locale: ptBR }),
      receita: monthRevenue.gross,
      liquido: monthRevenue.net,
      dinheiro: breakdown['dinheiro'] || 0,
      credito: breakdown['credito'] || 0,
      debito: breakdown['debito'] || 0,
      pix: breakdown['pix'] || 0,
      recorrente: breakdown['recorrente'] || 0,
      outro: breakdown['outro'] || 0
    };
  });

  // 2.1 Daily Revenue (Dynamic based on appliedDateRange)
  const daysInInterval = eachDayOfInterval({
    start: startOfDay(new Date(appliedDateRange.start)),
    end: endOfDay(new Date(appliedDateRange.end))
  });

  // Limit daily data to 60 days to avoid chart clutter
  const dailyDataToRender = daysInInterval.length > 60 
    ? daysInInterval.slice(-60) 
    : daysInInterval;

  const dailyRevenueData = dailyDataToRender.map(dayDate => {
    const start = startOfDay(dayDate);
    const end = endOfDay(dayDate);
    
    const dayPayments = filteredPayments.filter(p => {
      const dateVal = p.date;
      const pDate = dateVal?.toDate ? dateVal.toDate() : new Date(dateVal);
      return isWithinInterval(pDate, { start, end }) && p.status === 'paid';
    });

    const breakdown = dayPayments.reduce((acc, p) => {
      const method = p.method || 'outro';
      acc[method] = (acc[method] || 0) + p.amount;
      return acc;
    }, {} as Record<string, number>);

    return {
      name: format(dayDate, 'dd/MM', { locale: ptBR }),
      fullDate: format(dayDate, 'dd/MM/yyyy', { locale: ptBR }),
      dinheiro: breakdown['dinheiro'] || 0,
      credito: breakdown['credito'] || 0,
      debito: breakdown['debito'] || 0,
      pix: breakdown['pix'] || 0,
      recorrente: breakdown['recorrente'] || 0,
      outro: breakdown['outro'] || 0
    };
  });

  // 3. Class Enrollment Chart (Filtered)
  const classData = filteredClassesData.map(cls => ({
    name: cls.name,
    alunos: cls.studentIds?.length || 0
  }));

  // 3.1 Students per Instructor (Filtered)
  const instructorMap: Record<string, number> = {};
  filteredClassesData.forEach(cls => {
    const instructor = cls.instructor || 'Sem Instrutor';
    if (selectedInstructors.includes(instructor)) {
      instructorMap[instructor] = (instructorMap[instructor] || 0) + (cls.studentIds?.length || 0);
    }
  });
  const instructorData = Object.entries(instructorMap).map(([name, value]) => ({ name, value }));
  
  // 3.2 New Registrations by Month (Dynamic based on appliedDateRange)
  const registrationsData = monthsToRender.map(monthDate => {
    const start = startOfMonth(monthDate);
    const end = endOfMonth(monthDate);
    
    const monthRegistrations = students.filter(s => {
      if (!s.createdAt) return false;
      const cDate = s.createdAt.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
      return isWithinInterval(cDate, { start, end });
    });

    return {
      name: format(monthDate, 'MMM', { locale: ptBR }),
      cadastros: monthRegistrations.length
    };
  });

  // 4. Overdue Students (Filtered)
  const overdueStudents = filteredStudents.filter(s => {
    if (!s.nextPaymentDate) return false;
    const nextDate = new Date(s.nextPaymentDate);
    const now = new Date();
    if (nextDate >= now || s.status !== 'active') return false;
    
    // Apenas alunos com planos recorrentes (>= 28 dias ou >= 1 mês) são considerados inadimplentes
    const studentPlanIds = s.planIds || (s.planId ? [s.planId] : []);
    const studentPlans = plans.filter(p => studentPlanIds.includes(p.id));
    const hasRecurringPlan = studentPlans.some(p => p.durationMonths ? p.durationMonths >= 1 : (p.durationDays || 30) >= 28);
    
    return hasRecurringPlan;
  });

  const printCallList = (cls: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const enrolledStudents = (cls.studentIds || []).map((sid: string) => 
      students.find(s => s.id === sid)
    ).filter(Boolean);

    const scheduleHtml = cls.schedule && Object.keys(cls.schedule).length > 0
      ? Object.entries(cls.schedule).map(([day, times]: [string, any]) => 
          `<li>${day}: ${times.startTime} - ${times.endTime}</li>`
        ).join('')
      : (cls.daysOfWeek ? `<li>${cls.daysOfWeek?.join(', ')} - ${cls.startTime || cls.time}</li>` : '<li>Horário não definido</li>');

    printWindow.document.write(`
      <html>
        <head>
          <title>Lista de Chamada - ${cls.name}</title>
          <style>
            @page { size: A4 landscape; margin: 1cm; }
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 10px; color: #000; background: #fff; }
            .header { border-bottom: 3px solid #000; padding-bottom: 10px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: flex-end; }
            .header-left h1 { margin: 0; font-size: 24px; text-transform: uppercase; font-weight: 900; letter-spacing: -1px; }
            .header-right { text-align: right; font-size: 9px; text-transform: uppercase; font-weight: bold; color: #666; }
            .meta { display: grid; grid-template-columns: 1.5fr 1fr; gap: 20px; margin-bottom: 15px; }
            .meta-box { border: 1px solid #eee; padding: 10px; border-radius: 8px; }
            .meta-label { font-size: 9px; text-transform: uppercase; font-weight: 800; color: #999; margin-bottom: 3px; display: block; }
            .meta-value { font-size: 12px; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 5px; table-layout: fixed; }
            th, td { border: 1px solid #000; padding: 4px; text-align: left; font-size: 9px; overflow: hidden; }
            th { background-color: #f0f0f0; color: #000; text-transform: uppercase; font-weight: 900; font-size: 8px; text-align: center; }
            .num-col { width: 25px; text-align: center; font-weight: bold; }
            .name-col { width: 180px; }
            .day-col { width: 22px; text-align: center; font-weight: bold; }
            .footer { margin-top: 20px; border-top: 1px solid #eee; padding-top: 10px; font-size: 9px; display: flex; justify-content: space-between; color: #999; text-transform: uppercase; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-left">
              <h1>Lista de Chamada</h1>
              <div style="font-size: 12px; font-weight: bold; margin-top: 2px;">${cls.name}</div>
            </div>
            <div class="header-right">
              <div>Mês: _________________ / 2026</div>
              <div style="margin-top: 2px;">Total de Alunos: ${enrolledStudents.length}</div>
            </div>
          </div>
          
          <div class="meta">
            <div class="meta-box">
              <span class="meta-label">Instrutor Responsável</span>
              <span class="meta-value">${cls.instructor || 'Não definido'}</span>
              <div style="margin-top: 8px;">
                <span class="meta-label">Modalidade</span>
                <span class="meta-value">${cls.modality || 'Geral'}</span>
              </div>
            </div>
            <div class="meta-box">
              <span class="meta-label">Horários e Dias</span>
              <ul style="margin: 0; padding-left: 15px; font-size: 10px; font-weight: bold;">${scheduleHtml}</ul>
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th class="num-col">#</th>
                <th class="name-col">Nome do Aluno</th>
                ${Array.from({ length: 31 }).map((_, i) => `<th class="day-col">${i + 1}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${enrolledStudents.map((s, i) => `
                <tr>
                  <td class="num-col">${i + 1}</td>
                  <td class="name-col" style="font-weight: bold; white-space: nowrap;">${s.name.toUpperCase()}</td>
                  ${Array.from({ length: 31 }).map(() => `<td></td>`).join('')}
                </tr>
              `).join('')}
              ${Array.from({ length: Math.max(0, 12 - enrolledStudents.length) }).map((_, i) => `
                <tr>
                  <td class="num-col">${enrolledStudents.length + i + 1}</td>
                  <td class="name-col"></td>
                  ${Array.from({ length: 31 }).map(() => `<td></td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="footer">
            <span>Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}</span>
            <span>Sistema de Gestão Carrasco Fit</span>
            <span>Página 1 de 1</span>
          </div>

          <script>
            window.onload = () => {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const printMultipleCallLists = (classesToPrint: any[]) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    let allHtml = `
      <html>
        <head>
          <title>Listas de Chamada</title>
          <style>
            @page { size: A4 landscape; margin: 1cm; }
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 0; color: #000; background: #fff; }
            .page-break { page-break-after: always; padding: 15px; }
            .header { border-bottom: 3px solid #000; padding-bottom: 10px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: flex-end; }
            .header-left h1 { margin: 0; font-size: 24px; text-transform: uppercase; font-weight: 900; letter-spacing: -1px; }
            .header-right { text-align: right; font-size: 9px; text-transform: uppercase; font-weight: bold; color: #666; }
            .meta { display: grid; grid-template-columns: 1.5fr 1fr; gap: 20px; margin-bottom: 15px; }
            .meta-box { border: 1px solid #eee; padding: 10px; border-radius: 8px; }
            .meta-label { font-size: 9px; text-transform: uppercase; font-weight: 800; color: #999; margin-bottom: 3px; display: block; }
            .meta-value { font-size: 12px; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 5px; table-layout: fixed; }
            th, td { border: 1px solid #000; padding: 4px; text-align: left; font-size: 9px; overflow: hidden; }
            th { background-color: #f0f0f0; color: #000; text-transform: uppercase; font-weight: 900; font-size: 8px; text-align: center; }
            .num-col { width: 25px; text-align: center; font-weight: bold; }
            .name-col { width: 180px; }
            .day-col { width: 22px; text-align: center; font-weight: bold; }
            .footer { margin-top: 20px; border-top: 1px solid #eee; padding-top: 10px; font-size: 9px; display: flex; justify-content: space-between; color: #999; text-transform: uppercase; font-weight: bold; }
          </style>
        </head>
        <body>
    `;

    classesToPrint.forEach((cls, index) => {
      const enrolledStudents = (cls.studentIds || []).map((sid: string) => 
        students.find(s => s.id === sid)
      ).filter(Boolean);

      const scheduleHtml = cls.schedule && Object.keys(cls.schedule).length > 0
        ? Object.entries(cls.schedule).map(([day, times]: [string, any]) => 
            `<li>${day}: ${times.startTime} - ${times.endTime}</li>`
          ).join('')
        : (cls.daysOfWeek ? `<li>${cls.daysOfWeek?.join(', ')} - ${cls.startTime || cls.time}</li>` : '<li>Horário não definido</li>');

      allHtml += `
        <div class="page-break">
          <div class="header">
            <div class="header-left">
              <h1>Lista de Chamada</h1>
              <div style="font-size: 12px; font-weight: bold; margin-top: 2px;">${cls.name}</div>
            </div>
            <div class="header-right">
              <div>Mês: _________________ / 2026</div>
              <div style="margin-top: 2px;">Total de Alunos: ${enrolledStudents.length}</div>
            </div>
          </div>
          
          <div class="meta">
            <div class="meta-box">
              <span class="meta-label">Instrutor Responsável</span>
              <span class="meta-value">${cls.instructor || 'Não definido'}</span>
              <div style="margin-top: 8px;">
                <span class="meta-label">Modalidade</span>
                <span class="meta-value">${cls.modality || 'Geral'}</span>
              </div>
            </div>
            <div class="meta-box">
              <span class="meta-label">Horários e Dias</span>
              <ul style="margin: 0; padding-left: 15px; font-size: 10px; font-weight: bold;">${scheduleHtml}</ul>
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th class="num-col">#</th>
                <th class="name-col">Nome do Aluno</th>
                ${Array.from({ length: 31 }).map((_, i) => `<th class="day-col">${i + 1}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${enrolledStudents.map((s, i) => `
                <tr>
                  <td class="num-col">${i + 1}</td>
                  <td class="name-col" style="font-weight: bold; white-space: nowrap;">${s.name.toUpperCase()}</td>
                  ${Array.from({ length: 31 }).map(() => `<td></td>`).join('')}
                </tr>
              `).join('')}
              ${Array.from({ length: Math.max(0, 12 - enrolledStudents.length) }).map((_, i) => `
                <tr>
                  <td class="num-col">${enrolledStudents.length + i + 1}</td>
                  <td class="name-col"></td>
                  ${Array.from({ length: 31 }).map(() => `<td></td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="footer">
            <span>Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}</span>
            <span>Sistema de Gestão Carrasco Fit</span>
            <span>Turma ${index + 1} de ${classesToPrint.length}</span>
          </div>
        </div>
      `;
    });

    allHtml += `
          <script>
            window.onload = () => { window.print(); };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(allHtml);
    printWindow.document.close();
  };

  const printAllCallLists = () => {
    const attendanceClasses = classes.filter(cls => 
      !cls.name?.toLowerCase().includes('musculação') && 
      !cls.modality?.toLowerCase().includes('musculação')
    );
    printMultipleCallLists(attendanceClasses);
  };

  const printOnlyWithStudents = () => {
    const withStudents = classes.filter(cls => 
      (cls.studentIds || []).length > 0 &&
      !cls.name?.toLowerCase().includes('musculação') && 
      !cls.modality?.toLowerCase().includes('musculação')
    );
    if (withStudents.length === 0) {
      alert("Nenhuma turma com alunos registrados encontrada (excluindo Musculação).");
      return;
    }
    printMultipleCallLists(withStudents);
  };

  const printDailyRevenueReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // Group by day AND employee for the last 30 days
    const grouped: Record<string, Record<string, any>> = {};
    
    const last30DaysPayments = filteredPayments.filter(p => {
      const dateVal = p.date;
      const pDate = dateVal?.toDate ? dateVal.toDate() : new Date(dateVal);
      const thirtyDaysAgo = subDays(new Date(), 30);
      return pDate >= startOfDay(thirtyDaysAgo) && p.status === 'paid';
    });

    last30DaysPayments.forEach(p => {
      const dateVal = p.date;
      const d = dateVal?.toDate ? dateVal.toDate() : new Date(dateVal);
      const dateStr = isNaN(d.getTime()) ? 'N/A' : format(d, 'dd/MM/yyyy HH:mm');
      const emp = p.recordedByName || p.receivedBy || 'Sistema';
      
      if (!grouped[dateStr]) grouped[dateStr] = {};
      if (!grouped[dateStr][emp]) {
        grouped[dateStr][emp] = { dinheiro: 0, pix: 0, credito: 0, debito: 0, recorrente: 0, outro: 0 };
      }
      
      const method = p.method || 'outro';
      grouped[dateStr][emp][method] = (grouped[dateStr][emp][method] || 0) + p.amount;
    });

    // Sort dates descending
    const sortedDates = Object.keys(grouped).sort((a, b) => {
      const [da, ma, ya] = a.split('/').map(Number);
      const [db, mb, yb] = b.split('/').map(Number);
      return new Date(yb, mb-1, db).getTime() - new Date(ya, ma-1, da).getTime();
    });

    const breakdownTableHtml = sortedDates.flatMap(date => 
      Object.entries(grouped[date]).map(([emp, data]) => `
      <tr>
        <td>${date}</td>
        <td>${emp}</td>
        <td style="text-align: right;">R$ ${data.dinheiro.toFixed(2)}</td>
        <td style="text-align: right;">R$ ${data.pix.toFixed(2)}</td>
        <td style="text-align: right;">R$ ${data.credito.toFixed(2)}</td>
        <td style="text-align: right;">R$ ${data.debito.toFixed(2)}</td>
        <td style="text-align: right;">R$ ${data.recorrente.toFixed(2)}</td>
        <td style="text-align: right; font-weight: bold;">R$ ${(data.dinheiro + data.pix + data.credito + data.debito + data.recorrente + data.outro).toFixed(2)}</td>
      </tr>
    `)).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Relatório de Receita Diária</title>
          <style>
            @page { size: A4; margin: 1.5cm; }
            body { font-family: sans-serif; color: #333; line-height: 1.4; }
            h1 { text-transform: uppercase; border-bottom: 4px solid #000; padding-bottom: 10px; margin-bottom: 30px; font-size: 24px; }
            h2 { text-transform: uppercase; font-size: 16px; margin-top: 30px; border-left: 4px solid #facc15; padding-left: 10px; margin-bottom: 15px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #eee; padding: 10px; text-align: left; font-size: 10px; }
            th { background: #f9f9f9; text-transform: uppercase; font-size: 8px; font-weight: bold; }
            .footer { margin-top: 50px; font-size: 10px; text-align: center; color: #999; border-top: 1px solid #eee; padding-top: 20px; }
          </style>
        </head>
        <body>
          <h1>Relatório de Receita Diária</h1>
          <p style="font-size: 12px; color: #666;">Composição diária por método de pagamento e funcionário (últimos 30 dias com movimento).</p>

          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Funcionário</th>
                <th style="text-align: right;">Dinheiro</th>
                <th style="text-align: right;">PIX</th>
                <th style="text-align: right;">Crédito</th>
                <th style="text-align: right;">Débito</th>
                <th style="text-align: right;">Recorrente</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${breakdownTableHtml}
            </tbody>
          </table>

          <div class="footer">
            Relatório gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")} - Carrasco Fit
          </div>

          <script>
            window.onload = () => { window.print(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const printClosingReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const startDateTime = new Date(`${closingStart.date}T${closingStart.time}:00`);
    const endDateTime = new Date(`${closingEnd.date}T${closingEnd.time}:00`);
    
    // Filter payments within the interval
    const closingPayments = payments.filter(p => {
      const dateVal = p.date;
      const pDate = dateVal?.toDate ? dateVal.toDate() : new Date(dateVal);
      return pDate >= startDateTime && pDate <= endDateTime && p.status === 'paid';
    });

    // Group by method
    const methodSummary: Record<string, { count: number, total: number }> = {
      money: { count: 0, total: 0 },
      pix: { count: 0, total: 0 },
      credit: { count: 0, total: 0 },
      debit: { count: 0, total: 0 },
      recurring: { count: 0, total: 0 },
      outro: { count: 0, total: 0 }
    };

    closingPayments.forEach(p => {
      const m = p.method || 'outro';
      if (!methodSummary[m]) methodSummary[m] = { count: 0, total: 0 };
      methodSummary[m].count++;
      methodSummary[m].total += p.amount;
    });

    const totalAmount = closingPayments.reduce((acc, p) => acc + p.amount, 0);

    const paymentsTableHtml = closingPayments.sort((a, b) => {
      const da = a.date?.toDate ? a.date.toDate().getTime() : new Date(a.date).getTime();
      const db = b.date?.toDate ? b.date.toDate().getTime() : new Date(b.date).getTime();
      return db - da;
    }).map(p => {
      const student = students.find(s => s.id === p.studentId);
      const dateVal = p.date;
      const d = dateVal?.toDate ? dateVal.toDate() : new Date(dateVal);
      return `
        <tr>
          <td>${isNaN(d.getTime()) ? 'N/A' : format(d, 'dd/MM/yyyy HH:mm')}</td>
          <td>${(student?.name || 'N/A').toUpperCase()}</td>
          <td>${p.description || 'Pagamento'}</td>
          <td style="text-transform: uppercase;">${
            p.method === 'credit' ? 'CARTÃO CRÉDITO' : 
            p.method === 'debit' ? 'CARTÃO DÉBITO' : 
            p.method === 'pix' ? 'PIX' : 
            p.method === 'recurring' ? 'RECORRENTE' : 
            p.method === 'money' ? 'DINHEIRO' : 'OUTRO'
          }</td>
          <td style="text-align: right;">R$ ${p.amount.toFixed(2)}</td>
          <td>${p.recordedByName || p.receivedBy || 'Sistema'}</td>
        </tr>
      `;
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Fechamento de Caixa - ${format(startDateTime, 'dd/MM/yyyy HH:mm')} até ${format(endDateTime, 'dd/MM/yyyy HH:mm')}</title>
          <style>
            @page { size: A4; margin: 1.5cm; }
            body { font-family: sans-serif; color: #333; line-height: 1.4; }
            h1 { text-transform: uppercase; border-bottom: 4px solid #000; padding-bottom: 10px; margin-bottom: 20px; font-size: 22px; }
            .meta { margin-bottom: 30px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
            .meta-box { border: 1px solid #eee; padding: 15px; border-radius: 8px; }
            .meta-label { font-size: 10px; text-transform: uppercase; color: #999; font-weight: bold; margin-bottom: 5px; display: block; }
            .meta-value { font-size: 14px; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #eee; padding: 10px; text-align: left; font-size: 11px; }
            th { background: #f9f9f9; text-transform: uppercase; font-size: 9px; font-weight: bold; }
            .summary-table { width: 50%; margin-top: 30px; }
            .footer { margin-top: 50px; font-size: 10px; text-align: center; color: #999; border-top: 1px solid #eee; padding-top: 20px; }
          </style>
        </head>
        <body>
          <h1>Fechamento de Caixa</h1>
          
          <div class="meta">
            <div class="meta-box">
              <span class="meta-label">Período do Fechamento</span>
              <span class="meta-value">${format(startDateTime, 'dd/MM/yyyy HH:mm')} até ${format(endDateTime, 'dd/MM/yyyy HH:mm')}</span>
            </div>
            <div class="meta-box">
              <span class="meta-label">Total Recebido</span>
              <span class="meta-value">R$ ${totalAmount.toFixed(2)}</span>
            </div>
          </div>

          <h2>Resumo por Método</h2>
          <table class="summary-table">
            <thead>
              <tr>
                <th>Método</th>
                <th style="text-align: center;">Qtd</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(methodSummary).filter(([_, data]) => data.count > 0).map(([method, data]) => `
                <tr>
                  <td style="text-transform: uppercase; font-weight: bold;">${
                    method === 'credit' ? 'CARTÃO CRÉDITO' : 
                    method === 'debit' ? 'CARTÃO DÉBITO' : 
                    method === 'pix' ? 'PIX' : 
                    method === 'recurring' ? 'RECORRENTE' : 
                    method === 'money' ? 'DINHEIRO' : 'OUTRO'
                  }</td>
                  <td style="text-align: center;">${data.count}</td>
                  <td style="text-align: right;">R$ ${data.total.toFixed(2)}</td>
                </tr>
              `).join('')}
              <tr style="background: #f9f9f9; font-weight: bold;">
                <td>TOTAL GERAL</td>
                <td style="text-align: center;">${closingPayments.length}</td>
                <td style="text-align: right;">R$ ${totalAmount.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          <h2>Detalhamento de Recebimentos</h2>
          <table>
            <thead>
              <tr>
                <th>Data/Hora</th>
                <th>Aluno</th>
                <th>Descrição</th>
                <th>Método</th>
                <th style="text-align: right;">Valor</th>
                <th>Recebido por</th>
              </tr>
            </thead>
            <tbody>
              ${paymentsTableHtml}
            </tbody>
          </table>

          <div class="footer">
            Relatório de Fechamento gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")} - Carrasco Fit
          </div>

          <script>
            window.onload = () => { window.print(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const printRevenueReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const revenueTableHtml = revenueData.map(d => `
      <tr>
        <td>${d.name}</td>
        <td style="text-align: right;">R$ ${d.receita.toFixed(2)}</td>
        <td style="text-align: right; color: #22c55e;">R$ ${d.liquido.toFixed(2)}</td>
        <td style="text-align: right; color: #ef4444;">R$ ${(d.receita - d.liquido).toFixed(2)}</td>
      </tr>
    `).join('');

    const breakdownTableHtml = revenueData.map(d => `
      <tr>
        <td>${d.name}</td>
        <td style="text-align: right;">R$ ${d.dinheiro.toFixed(2)}</td>
        <td style="text-align: right;">R$ ${d.pix.toFixed(2)}</td>
        <td style="text-align: right;">R$ ${d.credito.toFixed(2)}</td>
        <td style="text-align: right;">R$ ${d.debito.toFixed(2)}</td>
        <td style="text-align: right;">R$ ${d.recorrente.toFixed(2)}</td>
      </tr>
    `).join('');

    const monthlyEmployeeData: Record<string, Record<string, number>> = {};
    const months = revenueData.map(d => d.name);

    filteredPayments.filter(p => p.status === 'paid').forEach(p => {
      const pDate = new Date(p.date);
      const monthName = format(pDate, 'MMM', { locale: ptBR });
      if (!months.includes(monthName)) return;
      
      const emp = p.recordedByName || p.receivedBy || 'Sistema';
      if (!monthlyEmployeeData[monthName]) monthlyEmployeeData[monthName] = {};
      monthlyEmployeeData[monthName][emp] = (monthlyEmployeeData[monthName][emp] || 0) + p.amount;
    });

    const employeeBreakdownHtml = months.flatMap(month => {
      const emps = monthlyEmployeeData[month] || {};
      return Object.entries(emps).map(([emp, total]) => `
        <tr>
          <td>${month}</td>
          <td>${emp}</td>
          <td style="text-align: right;">R$ ${total.toFixed(2)}</td>
        </tr>
      `);
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Relatório de Receita Mensal</title>
          <style>
            @page { size: A4; margin: 1.5cm; }
            body { font-family: sans-serif; color: #333; line-height: 1.4; }
            h1 { text-transform: uppercase; border-bottom: 4px solid #000; padding-bottom: 10px; margin-bottom: 30px; font-size: 24px; }
            h2 { text-transform: uppercase; font-size: 16px; margin-top: 30px; border-left: 4px solid #facc15; padding-left: 10px; margin-bottom: 15px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #eee; padding: 12px; text-align: left; font-size: 11px; }
            th { background: #f9f9f9; text-transform: uppercase; font-size: 9px; font-weight: bold; }
            .footer { margin-top: 50px; font-size: 10px; text-align: center; color: #999; border-top: 1px solid #eee; padding-top: 20px; }
          </style>
        </head>
        <body>
          <h1>Relatório de Receita Mensal</h1>
          <p style="font-size: 12px; color: #666;">Análise dos últimos 6 meses de faturamento e custos operacionais.</p>

          <h2>Resumo Financeiro</h2>
          <table>
            <thead>
              <tr>
                <th>Mês</th>
                <th style="text-align: right;">Receita Bruta</th>
                <th style="text-align: right;">Receita Líquida</th>
                <th style="text-align: right;">Custo de Taxas</th>
              </tr>
            </thead>
            <tbody>
              ${revenueTableHtml}
            </tbody>
          </table>

          <h2>Composição por Método de Pagamento</h2>
          <table>
            <thead>
              <tr>
                <th>Mês</th>
                <th style="text-align: right;">Dinheiro</th>
                <th style="text-align: right;">PIX</th>
                <th style="text-align: right;">Crédito</th>
                <th style="text-align: right;">Débito</th>
                <th style="text-align: right;">Recorrente</th>
              </tr>
            </thead>
            <tbody>
              ${breakdownTableHtml}
            </tbody>
          </table>

          <h2>Composição por Funcionário</h2>
          <table>
            <thead>
              <tr>
                <th>Mês</th>
                <th>Funcionário</th>
                <th style="text-align: right;">Total Recebido</th>
              </tr>
            </thead>
            <tbody>
              ${employeeBreakdownHtml}
            </tbody>
          </table>

          <div class="footer">
            Relatório gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")} - Carrasco Fit
          </div>

          <script>
            window.onload = () => { window.print(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const printDetailedTransactionsReport = (type: 'daily' | 'monthly' | 'custom') => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const targetPayments = filteredPayments.filter(p => {
      const pDate = new Date(p.date);
      if (type === 'daily') {
        const thirtyDaysAgo = subDays(new Date(), 30);
        return pDate >= startOfDay(thirtyDaysAgo) && p.status === 'paid';
      } else if (type === 'monthly') {
        const sixMonthsAgo = subMonths(new Date(), 6);
        return pDate >= startOfMonth(sixMonthsAgo) && p.status === 'paid';
      } else {
        return isWithinInterval(pDate, { 
          start: startOfDay(new Date(dateRange.start)), 
          end: endOfDay(new Date(dateRange.end)) 
        }) && p.status === 'paid';
      }
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const title = type === 'daily' ? 'Últimos 30 dias' : 
                  type === 'monthly' ? 'Últimos 6 meses' : 
                  `${format(new Date(dateRange.start), 'dd/MM/yyyy')} - ${format(new Date(dateRange.end), 'dd/MM/yyyy')}`;

    const tableRowsHtml = targetPayments.map(p => {
      const student = students.find(s => s.id === p.studentId);
      const studentName = (p.studentName || student?.name || 'Desconhecido').toUpperCase();
      const studentPlanIds = p.planIds || (student?.planIds || (student?.planId ? [student.planId] : []));
      const planNames = p.selectedPlans && p.selectedPlans.length > 0 
        ? p.selectedPlans.map((sp: any) => sp.planName).join(', ')
        : plans.filter(pl => studentPlanIds.includes(pl.id)).map(pl => pl.name).join(', ');
      
      return `
        <tr>
          <td>${format(new Date(p.date), 'dd/MM/yyyy HH:mm')}</td>
          <td>${studentName}</td>
          <td>${planNames || p.description || '-'}</td>
          <td>${
            p.method === 'credit' ? 'CRÉDITO' : 
            p.method === 'debit' ? 'DÉBITO' : 
            p.method === 'pix' ? 'PIX' : 
            p.method === 'recurring' ? 'RECORRENTE' : 'DINHEIRO'
          }</td>
          <td style="text-align: right;">R$ ${p.amount.toFixed(2)}</td>
          <td>${p.recordedByName || p.receivedBy || 'Sistema'}</td>
        </tr>
      `;
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Relatório Detalhado de Transações - ${title}</title>
          <style>
            @page { size: A4; margin: 1.5cm; }
            body { font-family: sans-serif; color: #333; line-height: 1.4; }
            h1 { text-transform: uppercase; border-bottom: 4px solid #000; padding-bottom: 10px; margin-bottom: 30px; font-size: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #eee; padding: 8px; text-align: left; font-size: 10px; }
            th { background: #f9f9f9; text-transform: uppercase; font-size: 8px; font-weight: bold; }
            .footer { margin-top: 50px; font-size: 10px; text-align: center; color: #999; border-top: 1px solid #eee; padding-top: 20px; }
          </style>
        </head>
        <body>
          <h1>Relatório Detalhado de Transações (${title})</h1>
          <table>
            <thead>
              <tr>
                <th>Data/Hora</th>
                <th>Aluno</th>
                <th>Modalidade/Plano</th>
                <th>Método</th>
                <th style="text-align: right;">Valor</th>
                <th>Funcionário</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </table>
          <div class="footer">
            Relatório gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")} - Carrasco Fit
          </div>
          <script>
            window.onload = () => { window.print(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const printCorporateReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const corporatePlans = plans.filter(p => p.isCorporate);
    const startDate = startOfDay(new Date(appliedDateRange.start));
    const endDate = endOfDay(new Date(appliedDateRange.end));

    const corporateReportHtml = corporatePlans.map(plan => {
      const planStudents = students.filter(s => {
        const studentPlanIds = s.planIds || (s.planId ? [s.planId] : []);
        return studentPlanIds.includes(plan.id);
      });

      const studentAccessCounts = planStudents.map(student => {
        const count = accessLogs.filter(log => {
          if (log.studentId !== student.id) return false;
          if (!log.timestamp) return false;
          const logDate = log.timestamp.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
          return isWithinInterval(logDate, { start: startDate, end: endDate }) && log.type === 'entry';
        }).length;

        return {
          name: student.name,
          count
        };
      }).sort((a, b) => b.count - a.count);

      return `
        <div style="margin-bottom: 40px; page-break-inside: avoid;">
          <h2 style="border-bottom: 3px solid #3b82f6; padding-bottom: 10px; margin-bottom: 15px; font-size: 18px; text-transform: uppercase; color: #1e40af;">
            Plano: ${plan.name}
            <span style="float: right; font-size: 12px; color: #666;">${planStudents.length} ALUNOS NO MÊS</span>
          </h2>
          <table>
            <thead>
              <tr>
                <th style="width: 40px;">#</th>
                <th>Nome do Aluno</th>
                <th style="text-align: center; width: 150px;">Acessos no Período</th>
              </tr>
            </thead>
            <tbody>
              ${studentAccessCounts.map((s, i) => `
                <tr>
                  <td style="text-align: center;">${i + 1}</td>
                  <td style="font-weight: bold;">${s.name.toUpperCase()}</td>
                  <td style="text-align: center; font-weight: 900; color: #3b82f6;">${s.count}</td>
                </tr>
              `).join('')}
              ${studentAccessCounts.length === 0 ? '<tr><td colspan="3" style="text-align: center; color: #999;">Nenhum aluno vinculado a este plano corporativo.</td></tr>' : ''}
            </tbody>
          </table>
        </div>
      `;
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Relatório de Planos Corporativos - ${format(startDate, 'dd/MM/yyyy')} a ${format(endDate, 'dd/MM/yyyy')}</title>
          <style>
            @page { size: A4; margin: 1.5cm; }
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; line-height: 1.4; }
            h1 { text-transform: uppercase; border-bottom: 5px solid #000; padding-bottom: 10px; margin-bottom: 30px; font-size: 24px; text-align: center; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #e5e7eb; padding: 12px; text-align: left; font-size: 12px; }
            th { background: #f8fafc; text-transform: uppercase; font-size: 10px; font-weight: bold; color: #64748b; }
            .footer { margin-top: 50px; font-size: 10px; text-align: center; color: #94a3b8; border-top: 1px solid #e5e7eb; padding-top: 20px; }
            .header-info { margin-bottom: 20px; text-align: center; font-size: 14px; font-weight: bold; color: #64748b; }
          </style>
        </head>
        <body>
          <h1>Relatório de Utilização Corporativa</h1>
          <div class="header-info">
            Período: ${format(startDate, 'dd/MM/yyyy')} até ${format(endDate, 'dd/MM/yyyy')}
          </div>
          
          ${corporateReportHtml}

          <div class="footer">
            Relatório gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")} - Carrasco Fit
          </div>

          <script>
            window.onload = () => { window.print(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const printSummaryReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const filteredClasses = classes.filter(c => selectedClasses.includes(c.id));
    const filteredInstructorData = instructorData.filter(i => selectedInstructors.includes(i.name));
    const corporatePlans = plans.filter(p => p.isCorporate);
    const startDate = startOfDay(new Date(appliedDateRange.start));
    const endDate = endOfDay(new Date(appliedDateRange.end));

    const instructorSummaryHtml = filteredInstructorData.map(i => `
      <tr>
        <td>${i.name}</td>
        <td style="text-align: right; font-weight: bold;">${i.value}</td>
      </tr>
    `).join('');

    const classSummaryHtml = filteredClasses.map(cls => `
      <tr>
        <td>${cls.name}</td>
        <td>${cls.instructor}</td>
        <td>${cls.modality || 'Geral'}</td>
        <td style="text-align: right; font-weight: bold;">${cls.studentIds?.length || 0}</td>
      </tr>
    `).join('');

    const filteredPaymentsForTable = payments.filter(p => {
      const pDate = new Date(p.date);
      return isWithinInterval(pDate, { 
        start: startOfDay(new Date(appliedDateRange.start)), 
        end: endOfDay(new Date(appliedDateRange.end)) 
      }) && filteredStudents.some(s => s.id === p.studentId);
    });

    const paymentsHtml = filteredPaymentsForTable.map(p => {
      const student = students.find(s => s.id === p.studentId);
      const studentName = (p.studentName || student?.name || 'Desconhecido').toUpperCase();
      const studentPlanIds = p.planIds || (student?.planIds || (student?.planId ? [student.planId] : []));
      const planNames = p.selectedPlans && p.selectedPlans.length > 0 
        ? p.selectedPlans.map((sp: any) => sp.planName).join(', ')
        : plans.filter(pl => studentPlanIds.includes(pl.id)).map(pl => pl.name).join(', ');

      return `
        <tr>
          <td>${format(new Date(p.date), 'dd/MM/yyyy HH:mm')}</td>
          <td>${studentName}</td>
          <td>${planNames || p.description || 'Pagamento'}</td>
          <td>${
            p.method === 'credit' ? 'CARTÃO CRÉDITO' : 
            p.method === 'debit' ? 'CARTÃO DÉBITO' : 
            p.method === 'pix' ? 'PIX' : 
            p.method === 'recurring' ? 'RECORRENTE' : 'DINHEIRO'
          }</td>
          <td style="text-align: right;">R$ ${p.amount.toFixed(2)}</td>
          <td style="text-align: right; color: #ef4444;">R$ ${(p.fee || 0).toFixed(2)}</td>
          <td style="text-align: right; font-weight: bold;">R$ ${(p.netAmount || p.amount).toFixed(2)}</td>
          <td>${p.recordedByName || p.receivedBy || 'Sistema'}</td>
        </tr>
      `;
    }).join('');

    const totalGross = filteredPaymentsForTable.reduce((acc, p) => acc + p.amount, 0);
    const totalFees = filteredPaymentsForTable.reduce((acc, p) => acc + (p.fee || 0), 0);
    const totalNet = filteredPaymentsForTable.reduce((acc, p) => acc + (p.netAmount || p.amount), 0);

    const registrationsSummaryHtml = registrationsData.map(d => `
      <tr>
        <td>${d.name}</td>
        <td style="text-align: right; font-weight: bold;">${d.cadastros}</td>
      </tr>
    `).join('');

    // Summary by Method
    const methodSummary: Record<string, { gross: number, fee: number, net: number }> = {
      money: { gross: 0, fee: 0, net: 0 },
      pix: { gross: 0, fee: 0, net: 0 },
      credit: { gross: 0, fee: 0, net: 0 },
      debit: { gross: 0, fee: 0, net: 0 },
      recurring: { gross: 0, fee: 0, net: 0 }
    };

    filteredPaymentsForTable.forEach(p => {
      const m = p.method || 'money';
      if (methodSummary[m]) {
        methodSummary[m].gross += p.amount;
        methodSummary[m].fee += (p.fee || 0);
        methodSummary[m].net += (p.netAmount || p.amount);
      }
    });

    const methodSummaryHtml = Object.entries(methodSummary)
      .filter(([_, data]) => data.gross > 0)
      .map(([method, data]) => `
        <tr>
          <td style="text-transform: uppercase; font-weight: bold;">${
            method === 'credit' ? 'CARTÃO CRÉDITO' : 
            method === 'debit' ? 'CARTÃO DÉBITO' : 
            method === 'pix' ? 'PIX' : 
            method === 'recurring' ? 'RECORRENTE' : 'DINHEIRO'
          }</td>
          <td style="text-align: right;">R$ ${data.gross.toFixed(2)}</td>
          <td style="text-align: right; color: #ef4444;">R$ ${data.fee.toFixed(2)}</td>
          <td style="text-align: right; font-weight: bold;">R$ ${data.net.toFixed(2)}</td>
        </tr>
      `).join('');

    const studentsPerClassHtml = filteredClasses.map(cls => {
      const enrolled = (cls.studentIds || []).map((sid: string) => 
        students.find(s => s.id === sid)
      ).filter(Boolean);

      return `
        <div style="margin-bottom: 30px; page-break-inside: avoid;">
          <h3 style="border-bottom: 2px solid #facc15; padding-bottom: 5px; margin-bottom: 10px; font-size: 14px; text-transform: uppercase;">
            ${cls.name} <span style="float: right; font-size: 10px; color: #666;">${enrolled.length} ALUNOS</span>
          </h3>
          <table style="margin-top: 5px;">
            <thead>
              <tr><th>#</th><th>Nome do Aluno</th><th>Status</th><th>Próximo Vencimento</th></tr>
            </thead>
            <tbody>
              ${enrolled.map((s, i) => `
                <tr>
                  <td style="width: 20px;">${i + 1}</td>
                  <td style="font-weight: bold;">${s.name.toUpperCase()}</td>
                  <td>${s.status === 'active' ? 'ATIVO' : 'INATIVO'}</td>
                  <td>${s.nextPaymentDate ? format(new Date(s.nextPaymentDate), 'dd/MM/yyyy') : 'N/A'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Relatório Geral - Academia</title>
          <style>
            @page { size: A4; margin: 1.5cm; }
            body { font-family: sans-serif; color: #333; line-height: 1.4; }
            h1 { text-transform: uppercase; border-bottom: 4px solid #000; padding-bottom: 10px; margin-bottom: 30px; font-size: 24px; }
            h2 { text-transform: uppercase; font-size: 16px; margin-top: 40px; border-left: 4px solid #facc15; padding-left: 10px; margin-bottom: 15px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #eee; padding: 10px; text-align: left; font-size: 12px; }
            th { background: #f9f9f9; text-transform: uppercase; font-size: 10px; font-weight: bold; }
            .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px; }
            .stat-card { border: 1px solid #eee; padding: 15px; border-radius: 8px; text-align: center; }
            .stat-label { font-size: 10px; text-transform: uppercase; color: #999; font-weight: bold; }
            .stat-value { font-size: 24px; font-weight: bold; color: #000; }
            .footer { margin-top: 50px; font-size: 10px; text-align: center; color: #999; border-top: 1px solid #eee; padding-top: 20px; }
          </style>
        </head>
        <body>
          <h1>Relatório de Gestão: Carrasco Fit</h1>
          
          ${selectedComponents.summaryTable ? `
          <h2>Resumo Geral</h2>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-label">Total de Alunos</div>
              <div class="stat-value">${students.length}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Alunos Ativos</div>
              <div class="stat-value">${activeCount}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Total de Turmas</div>
              <div class="stat-value">${classes.length}</div>
            </div>
          </div>
          ` : ''}

          ${selectedComponents.statusChart ? `
          <h2>Distribuição de Alunos</h2>
          <table>
            <thead>
              <tr><th>Status</th><th style="text-align: right;">Total</th></tr>
            </thead>
            <tbody>
              <tr><td>Ativos</td><td style="text-align: right;">${activeCount}</td></tr>
              <tr><td>Inativos</td><td style="text-align: right;">${students.length - activeCount}</td></tr>
              <tr style="font-weight: bold;"><td>TOTAL</td><td style="text-align: right;">${students.length}</td></tr>
            </tbody>
          </table>
          ` : ''}

          ${selectedComponents.revenueChart ? `
          <h2>Receita no Período (${format(new Date(appliedDateRange.start), 'dd/MM/yyyy')} - ${format(new Date(appliedDateRange.end), 'dd/MM/yyyy')})</h2>
          <table>
            <thead>
              <tr><th>Período</th><th>Receita</th></tr>
            </thead>
            <tbody>
              ${revenueData.map(d => `<tr><td>${d.name}</td><td>R$ ${d.receita.toFixed(2)}</td></tr>`).join('')}
            </tbody>
          </table>
          ` : ''}

          ${selectedComponents.detailedPayments ? `
          <h2>Detalhamento de Pagamentos (Resumo por Método)</h2>
          <table>
            <thead>
              <tr>
                <th>Método</th>
                <th style="text-align: right;">Bruto</th>
                <th style="text-align: right;">Custo</th>
                <th style="text-align: right;">Líquido</th>
              </tr>
            </thead>
            <tbody>
              ${methodSummaryHtml}
              <tr style="background: #f9f9f9; font-weight: bold;">
                <td>TOTAIS</td>
                <td style="text-align: right;">R$ ${totalGross.toFixed(2)}</td>
                <td style="text-align: right; color: #ef4444;">R$ ${totalFees.toFixed(2)}</td>
                <td style="text-align: right;">R$ ${totalNet.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          <h2>Detalhamento de Pagamentos (${format(new Date(appliedDateRange.start), 'dd/MM/yyyy')} - ${format(new Date(appliedDateRange.end), 'dd/MM/yyyy')})</h2>
          <table>
            <thead>
              <tr>
                <th>Data/Hora</th>
                <th>Aluno</th>
                <th>Modalidade/Plano</th>
                <th>Método</th>
                <th style="text-align: right;">Bruto</th>
                <th style="text-align: right;">Custo</th>
                <th style="text-align: right;">Líquido</th>
                <th>Funcionário</th>
              </tr>
            </thead>
            <tbody>
              ${paymentsHtml}
              <tr style="background: #f9f9f9; font-weight: bold;">
                <td colspan="4" style="text-align: right;">TOTAL NO PERÍODO:</td>
                <td style="text-align: right;">R$ ${totalGross.toFixed(2)}</td>
                <td style="text-align: right; color: #ef4444;">R$ ${totalFees.toFixed(2)}</td>
                <td style="text-align: right;">R$ ${totalNet.toFixed(2)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
          ` : ''}

          ${selectedComponents.instructorChart ? `
          <h2>Resumo por Instrutor</h2>
          <table>
            <thead>
              <tr>
                <th>Instrutor</th>
                <th style="text-align: right;">Total de Alunos (Matrículas)</th>
              </tr>
            </thead>
            <tbody>
              ${instructorSummaryHtml}
            </tbody>
          </table>
          ` : ''}

          ${selectedComponents.classChart ? `
          <h2>Alunos por Modalidade</h2>
          <table>
            <thead>
              <tr>
                <th>Turma</th>
                <th>Instrutor</th>
                <th>Modalidade</th>
                <th style="text-align: right;">Alunos</th>
              </tr>
            </thead>
            <tbody>
              ${classSummaryHtml}
            </tbody>
          </table>
          ` : ''}

          ${selectedComponents.classDetails ? `
          <h2>Relatório de Turmas e Modalidades</h2>
          <table>
            <thead>
              <tr><th>Turma</th><th>Instrutor</th><th>Modalidade</th><th>Horários</th></tr>
            </thead>
            <tbody>
              ${filteredClasses.map(cls => {
                const schedule = cls.schedule && Object.keys(cls.schedule).length > 0
                  ? Object.entries(cls.schedule).map(([day, times]: [string, any]) => `${day}: ${times.startTime}-${times.endTime}`).join(', ')
                  : (cls.daysOfWeek ? `${cls.daysOfWeek?.join(', ')} - ${cls.startTime || cls.time}` : 'N/A');
                return `
                  <tr>
                    <td>${cls.name}</td>
                    <td>${cls.instructor}</td>
                    <td>${cls.modality || 'Geral'}</td>
                    <td>${schedule}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          ` : ''}

          ${selectedComponents.studentsPerClass ? `
          <h2>Alunos por Turma</h2>
          ${studentsPerClassHtml}
          ` : ''}

          ${selectedComponents.overdueTable ? `
          <h2>Inadimplência (Vencidos)</h2>
          <table>
            <thead>
              <tr><th>Aluno</th><th>Vencimento</th><th>Status</th></tr>
            </thead>
            <tbody>
              ${overdueStudents.map(s => `<tr><td>${s.name.toUpperCase()}</td><td>${format(new Date(s.nextPaymentDate), 'dd/MM/yyyy')}</td><td>Vencido</td></tr>`).join('')}
            </tbody>
          </table>
          ` : ''}

          ${selectedComponents.attendanceList ? `
          <div style="page-break-before: always;">
            <h2>Lista de Chamada</h2>
            ${filteredClasses
              .filter(cls => 
                !cls.name?.toLowerCase().includes('musculação') && 
                !cls.modality?.toLowerCase().includes('musculação')
              )
              .map((cls) => {
              const enrolled = (cls.studentIds || []).map((sid: string) => 
                students.find(s => s.id === sid)
              ).filter(Boolean);
              
              return `
                <div style="margin-bottom: 50px; page-break-inside: avoid;">
                  <h3 style="border-bottom: 2px solid #facc15; padding-bottom: 5px; margin-bottom: 10px; font-size: 14px; text-transform: uppercase;">
                    ${cls.name} <span style="float: right; font-size: 10px; color: #666;">${enrolled.length} ALUNOS</span>
                  </h3>
                  <table style="width: 100%; border-collapse: collapse; margin-top: 5px; table-layout: fixed;">
                    <thead>
                      <tr>
                        <th style="width: 25px; border: 1px solid #eee; padding: 4px; font-size: 8px;">#</th>
                        <th style="width: 180px; border: 1px solid #eee; padding: 4px; font-size: 8px;">Nome do Aluno</th>
                        ${Array.from({ length: 31 }).map((_, i) => `<th style="width: 22px; border: 1px solid #eee; padding: 4px; font-size: 8px;">${i + 1}</th>`).join('')}
                      </tr>
                    </thead>
                    <tbody>
                      ${enrolled.map((s, i) => `
                        <tr>
                          <td style="border: 1px solid #eee; padding: 4px; font-size: 9px; text-align: center;">${i + 1}</td>
                          <td style="border: 1px solid #eee; padding: 4px; font-size: 9px; font-weight: bold; white-space: nowrap; overflow: hidden;">${s.name.toUpperCase()}</td>
                          ${Array.from({ length: 31 }).map(() => `<td style="border: 1px solid #eee; padding: 4px;"></td>`).join('')}
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              `;
            }).join('')}
          </div>
          ` : ''}

          ${selectedComponents.registrationsChart ? `
          <h2>Novos Cadastros por Mês</h2>
          <table>
            <thead>
              <tr>
                <th>Mês</th>
                <th style="text-align: right;">Novos Alunos</th>
              </tr>
            </thead>
            <tbody>
              ${registrationsSummaryHtml}
            </tbody>
          </table>
          ` : ''}

          ${selectedComponents.corporateReport ? `
          <div style="page-break-before: always;">
            <h2 style="border-left: 4px solid #3b82f6; padding-left: 10px;">Relatório de Utilização Corporativa</h2>
            ${corporatePlans.map(plan => {
              const planStudents = students.filter(s => {
                const studentPlanIds = s.planIds || (s.planId ? [s.planId] : []);
                return studentPlanIds.includes(plan.id);
              });

              const studentAccessCounts = planStudents.map(student => {
                const count = accessLogs.filter(log => {
                  if (log.studentId !== student.id) return false;
                  if (!log.timestamp) return false;
                  const logDate = log.timestamp.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
                  return isWithinInterval(logDate, { start: startDate, end: endDate }) && log.type === 'entry';
                }).length;

                return { name: student.name, count };
              }).sort((a, b) => b.count - a.count);

              return `
                <div style="margin-bottom: 30px; page-break-inside: avoid;">
                  <h3 style="border-bottom: 2px solid #3b82f6; padding-bottom: 5px; margin-bottom: 10px; font-size: 14px; text-transform: uppercase; color: #1e40af;">
                    ${plan.name} <span style="float: right; font-size: 10px; color: #666;">${planStudents.length} ALUNOS</span>
                  </h3>
                  <table>
                    <thead>
                      <tr><th>#</th><th>Nome do Aluno</th><th style="text-align: center;">Acessos</th></tr>
                    </thead>
                    <tbody>
                      ${studentAccessCounts.map((s, i) => `
                        <tr>
                          <td style="width: 20px; text-align: center;">${i + 1}</td>
                          <td style="font-weight: bold;">${s.name.toUpperCase()}</td>
                          <td style="text-align: center; font-weight: bold; color: #3b82f6;">${s.count}</td>
                        </tr>
                      `).join('')}
                      ${studentAccessCounts.length === 0 ? '<tr><td colspan="3" style="text-align: center; color: #999;">Nenhum acesso registrado.</td></tr>' : ''}
                    </tbody>
                  </table>
                </div>
              `;
            }).join('')}
          </div>
          ` : ''}

          <div class="footer">
            Relatório gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}
          </div>

          <script>
            window.onload = () => { window.print(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-8 pb-12">
      <header>
        <h2 className="text-3xl font-bold tracking-tight text-white italic uppercase tracking-tighter">Relatórios</h2>
        <p className="text-neutral-500">Análise de desempenho e saúde financeira da academia.</p>
      </header>

      {/* Configuration Section */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white uppercase tracking-widest flex items-center gap-2">
            <BarChart3 className="text-yellow-400" size={20} />
            Configurar Relatório Personalizado
          </h2>
          <button 
            onClick={printSummaryReport}
            className="bg-yellow-400 text-black px-6 py-2 rounded-xl font-black text-xs flex items-center gap-2 hover:bg-yellow-300 transition-colors uppercase tracking-widest shadow-lg shadow-yellow-400/20"
          >
            <Printer size={16} /> Gerar Relatório Selecionado
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Components Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <h3 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Seções do Relatório</h3>
              <div className="flex gap-2">
                <button 
                  onClick={() => setSelectedComponents({
                    revenueChart: true,
                    statusChart: true,
                    classChart: true,
                    instructorChart: true,
                    overdueTable: true,
                    summaryTable: true,
                    classDetails: true,
                    studentsPerClass: true,
                    detailedPayments: true,
                    attendanceList: true,
                    corporateReport: true,
                    registrationsChart: true
                  })}
                  className="text-[9px] font-bold text-yellow-400 hover:text-yellow-300 uppercase"
                >
                  Todas
                </button>
                <button 
                  onClick={() => setSelectedComponents({
                    revenueChart: false,
                    statusChart: false,
                    classChart: false,
                    instructorChart: false,
                    overdueTable: false,
                    summaryTable: false,
                    classDetails: false,
                    studentsPerClass: false,
                    detailedPayments: false,
                    attendanceList: false,
                    corporateReport: false,
                    registrationsChart: false
                  })}
                  className="text-[9px] font-bold text-neutral-500 hover:text-neutral-400 uppercase"
                >
                  Nenhuma
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {Object.entries(selectedComponents).map(([key, value]) => {
                const componentNames: Record<string, string> = {
                  revenueChart: "Receita Mensal",
                  statusChart: "Distribuição de Alunos",
                  classChart: "Alunos por Modalidade",
                  instructorChart: "Resumo por Instrutor",
                  overdueTable: "Inadimplência (Vencidos)",
                  summaryTable: "Resumo Geral",
                  classDetails: "Relatório de Turmas e Modalidades",
                  studentsPerClass: "Alunos por Turma",
                  detailedPayments: "Detalhamento de Pagamentos",
                  attendanceList: "Lista de Chamada",
                  corporateReport: "Relatório Corporativo (Wellhub/TotalPass)",
                  registrationsChart: "Novos Cadastros por Mês"
                };
                
                return (
                  <label key={key} className="flex items-center gap-3 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      checked={value}
                      onChange={() => setSelectedComponents(prev => ({ ...prev, [key]: !prev[key] }))}
                      className="w-4 h-4 rounded border-neutral-700 bg-black text-yellow-400 focus:ring-yellow-400 focus:ring-offset-black"
                    />
                    <span className="text-xs text-neutral-400 group-hover:text-white transition-colors">
                      {componentNames[key as keyof typeof componentNames] || key}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Classes Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <h3 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Filtrar Turmas</h3>
              <div className="flex gap-2">
                <button 
                  onClick={() => setSelectedClasses(classes.map(c => c.id))}
                  className="text-[9px] font-bold text-yellow-400 hover:text-yellow-300 uppercase"
                >
                  Todas
                </button>
                <button 
                  onClick={() => setSelectedClasses([])}
                  className="text-[9px] font-bold text-neutral-500 hover:text-neutral-400 uppercase"
                >
                  Nenhuma
                </button>
              </div>
            </div>
            <div className="max-h-40 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
              {classes.map(cls => (
                <label key={cls.id} className="flex items-center gap-3 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={selectedClasses.includes(cls.id)}
                    onChange={() => {
                      setSelectedClasses(prev => 
                        prev.includes(cls.id) ? prev.filter(id => id !== cls.id) : [...prev, cls.id]
                      );
                    }}
                    className="w-4 h-4 rounded border-neutral-700 bg-black text-yellow-400 focus:ring-yellow-400 focus:ring-offset-black"
                  />
                  <span className="text-xs text-neutral-400 group-hover:text-white transition-colors truncate">
                    {cls.name}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Instructors Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <h3 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Filtrar Instrutores</h3>
              <div className="flex gap-2">
                <button 
                  onClick={() => setSelectedInstructors(Array.from(new Set(classes.map(c => c.instructor).filter(Boolean))))}
                  className="text-[9px] font-bold text-yellow-400 hover:text-yellow-300 uppercase"
                >
                  Todos
                </button>
                <button 
                  onClick={() => setSelectedInstructors([])}
                  className="text-[9px] font-bold text-neutral-500 hover:text-neutral-400 uppercase"
                >
                  Nenhum
                </button>
              </div>
            </div>
            <div className="max-h-40 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
              {Array.from(new Set(classes.map(c => c.instructor).filter(Boolean))).map(instructor => (
                <label key={instructor} className="flex items-center gap-3 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={selectedInstructors.includes(instructor)}
                    onChange={() => {
                      setSelectedInstructors(prev => 
                        prev.includes(instructor) ? prev.filter(i => i !== instructor) : [...prev, instructor]
                      );
                    }}
                    className="w-4 h-4 rounded border-neutral-700 bg-black text-yellow-400 focus:ring-yellow-400 focus:ring-offset-black"
                  />
                  <span className="text-xs text-neutral-400 group-hover:text-white transition-colors">
                    {instructor}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Date Range Selection for Reports */}
        <div className="pt-4 border-t border-neutral-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-neutral-500" />
              <span className="text-[10px] font-bold text-neutral-500 uppercase">Período do Relatório:</span>
            </div>
            <div className="flex items-center gap-2">
              <input 
                type="date"
                className="bg-black border border-neutral-800 rounded-lg px-2 py-1 text-[10px] text-white outline-none focus:border-yellow-400"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              />
              <span className="text-neutral-600 text-xs">até</span>
              <input 
                type="date"
                className="bg-black border border-neutral-800 rounded-lg px-2 py-1 text-[10px] text-white outline-none focus:border-yellow-400"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              />
              <button
                onClick={handleApplyFilter}
                className="p-1.5 rounded-lg bg-yellow-400 text-black hover:bg-yellow-300 transition-all flex items-center gap-1.5 shadow-lg shadow-yellow-400/20 group"
                title="Aplicar Filtro de Data"
              >
                <RefreshCcw size={14} className={cn("transition-transform duration-500", dateRange !== appliedDateRange && "animate-spin-slow group-hover:rotate-180")} />
                <span className="text-[9px] font-black uppercase">Aplicar Filtro</span>
              </button>

              <button
                onClick={() => printDetailedTransactionsReport('custom')}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-400 text-[9px] font-bold uppercase tracking-widest hover:bg-neutral-800 hover:text-white transition-all ml-2"
              >
                <Download size={14} />
                Imprimir Detalhamento
              </button>

              <button
                onClick={printCorporateReport}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-blue-400 text-[9px] font-bold uppercase tracking-widest hover:bg-neutral-800 hover:text-blue-300 transition-all ml-2"
              >
                <TrendingUp size={14} />
                Relatório Corporativo
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-neutral-800/50 p-2 rounded-xl border border-neutral-700">
              <div className="flex items-center gap-2">
                <RefreshCcw size={14} className="text-yellow-400" />
                <span className="text-[10px] font-bold text-neutral-400 uppercase">Fechamento de Caixa:</span>
              </div>
              <div className="flex items-center gap-1">
                <input 
                  type="date"
                  className="bg-black border border-neutral-800 rounded-lg px-2 py-1 text-[10px] text-white outline-none focus:border-yellow-400"
                  value={closingStart.date}
                  onChange={(e) => setClosingStart({ ...closingStart, date: e.target.value })}
                />
                <input 
                  type="time"
                  className="bg-black border border-neutral-800 rounded-lg px-2 py-1 text-[10px] text-white outline-none focus:border-yellow-400"
                  value={closingStart.time}
                  onChange={(e) => setClosingStart({ ...closingStart, time: e.target.value })}
                />
              </div>
              <span className="text-neutral-600 text-[10px] font-bold uppercase">até</span>
              <div className="flex items-center gap-1">
                <input 
                  type="date"
                  className="bg-black border border-neutral-800 rounded-lg px-2 py-1 text-[10px] text-white outline-none focus:border-yellow-400"
                  value={closingEnd.date}
                  onChange={(e) => setClosingEnd({ ...closingEnd, date: e.target.value })}
                />
                <input 
                  type="time"
                  className="bg-black border border-neutral-800 rounded-lg px-2 py-1 text-[10px] text-white outline-none focus:border-yellow-400"
                  value={closingEnd.time}
                  onChange={(e) => setClosingEnd({ ...closingEnd, time: e.target.value })}
                />
              </div>
              <button
                onClick={printClosingReport}
                className="bg-yellow-400 text-black px-4 py-1.5 rounded-lg font-black text-[9px] uppercase hover:bg-yellow-300 transition-all shadow-lg shadow-yellow-400/20"
              >
                Gerar Fechamento
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Revenue Chart */}
        {selectedComponents.revenueChart && (
          <div className="bg-black p-6 rounded-2xl shadow-sm border border-neutral-800 space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="font-bold flex items-center gap-2 text-white uppercase tracking-widest text-sm">
                  <TrendingUp size={18} className="text-yellow-400" />
                  Receita Mensal (R$)
                </h3>
                <p className="text-[10px] text-neutral-500 uppercase font-medium">Evolução Bruta vs Líquida</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => printDetailedTransactionsReport('monthly')}
                  className="p-2 text-neutral-500 hover:text-yellow-400 hover:bg-yellow-400/10 rounded-lg transition-all"
                  title="Imprimir Relatório Detalhado Mensal"
                >
                  <Download size={16} />
                </button>
                <button 
                  onClick={printRevenueReport}
                  className="p-2 text-neutral-500 hover:text-yellow-400 hover:bg-yellow-400/10 rounded-lg transition-all"
                  title="Imprimir Relatório de Receita"
                >
                  <Printer size={16} />
                </button>
              </div>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262626" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#737373' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#737373' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#000', border: '1px solid #262626', borderRadius: '12px', color: '#fff' }}
                    formatter={(value: number, name: string) => [`R$ ${value.toFixed(2)}`, name === 'receita' ? 'Bruto' : 'Líquido']}
                  />
                  <Line type="monotone" dataKey="receita" stroke="#facc15" strokeWidth={3} dot={{ r: 4, fill: '#facc15' }} activeDot={{ r: 6 }} name="receita" />
                  <Line type="monotone" dataKey="liquido" stroke="#22c55e" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3, fill: '#22c55e' }} name="liquido" />
                  <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '20px', fontSize: '10px', textTransform: 'uppercase' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="pt-6 border-t border-neutral-800 space-y-4">
              <div className="space-y-1">
                <h3 className="font-bold flex items-center gap-2 text-white uppercase tracking-widest text-sm">
                  <BarChart3 size={18} className="text-yellow-400" />
                  Composição Mensal
                </h3>
                <p className="text-[10px] text-neutral-500 uppercase font-medium">Distribuição de recebimentos por mês</p>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262626" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#737373' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#737373' }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#000', border: '1px solid #262626', borderRadius: '12px', color: '#fff' }}
                      formatter={(value: number, name: string) => [`R$ ${value.toFixed(2)}`, name.charAt(0).toUpperCase() + name.slice(1)]}
                    />
                    <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '20px', fontSize: '10px', textTransform: 'uppercase' }} />
                    <Bar dataKey="dinheiro" stackId="a" fill="#facc15" name="Dinheiro" />
                    <Bar dataKey="pix" stackId="a" fill="#22d3ee" name="PIX" />
                    <Bar dataKey="credito" stackId="a" fill="#818cf8" name="Crédito" />
                    <Bar dataKey="debito" stackId="a" fill="#f472b6" name="Débito" />
                    <Bar dataKey="recorrente" stackId="a" fill="#4ade80" name="Recorrente" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="pt-6 border-t border-neutral-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="font-bold flex items-center gap-2 text-white uppercase tracking-widest text-sm">
                    <Calendar size={18} className="text-yellow-400" />
                    Composição Diária
                  </h3>
                  <p className="text-[10px] text-neutral-500 uppercase font-medium">Últimos 30 dias</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => printDetailedTransactionsReport('daily')}
                    className="p-2 text-neutral-500 hover:text-yellow-400 hover:bg-yellow-400/10 rounded-lg transition-all"
                    title="Imprimir Relatório Detalhado Diário"
                  >
                    <Download size={16} />
                  </button>
                  <button 
                    onClick={printDailyRevenueReport}
                    className="p-2 text-neutral-500 hover:text-yellow-400 hover:bg-yellow-400/10 rounded-lg transition-all"
                    title="Imprimir Relatório Diário"
                  >
                    <Printer size={16} />
                  </button>
                </div>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyRevenueData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262626" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#737373' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#737373' }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#000', border: '1px solid #262626', borderRadius: '12px', color: '#fff' }}
                      formatter={(value: number, name: string) => [`R$ ${value.toFixed(2)}`, name.charAt(0).toUpperCase() + name.slice(1)]}
                    />
                    <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '20px', fontSize: '10px', textTransform: 'uppercase' }} />
                    <Bar dataKey="dinheiro" stackId="a" fill="#facc15" name="Dinheiro" />
                    <Bar dataKey="pix" stackId="a" fill="#22d3ee" name="PIX" />
                    <Bar dataKey="credito" stackId="a" fill="#818cf8" name="Crédito" />
                    <Bar dataKey="debito" stackId="a" fill="#f472b6" name="Débito" />
                    <Bar dataKey="recorrente" stackId="a" fill="#4ade80" name="Recorrente" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* New Registrations Chart */}
        {selectedComponents.registrationsChart && (
          <div className="bg-black p-6 rounded-2xl shadow-sm border border-neutral-800 space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="font-bold flex items-center gap-2 text-white uppercase tracking-widest text-sm">
                  <UserPlus size={18} className="text-yellow-400" />
                  Novos Cadastros por Mês
                </h3>
                <p className="text-[10px] text-neutral-500 uppercase font-medium">Evolução de Novas Matrículas</p>
              </div>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={registrationsData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262626" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#737373' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#737373' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#000', border: '1px solid #262626', borderRadius: '12px', color: '#fff' }}
                    formatter={(value: number) => [value, 'Cadastros']}
                  />
                  <Bar dataKey="cadastros" fill="#facc15" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Status Chart */}
        {selectedComponents.statusChart && (
          <div className="bg-black p-6 rounded-2xl shadow-sm border border-neutral-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold flex items-center gap-2 text-white uppercase tracking-widest text-sm">
                <PieChartIcon size={18} className="text-yellow-400" />
                Distribuição de Alunos
              </h3>
            </div>
            <div className="h-64 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#22c55e' : '#ef4444'} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#000', border: '1px solid #262626', borderRadius: '12px', color: '#fff' }}
                  />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ color: '#737373', fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold' }}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Class Enrollment Chart */}
        {selectedComponents.classChart && (
          <div className="bg-black p-6 rounded-2xl shadow-sm border border-neutral-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold flex items-center gap-2 text-white uppercase tracking-widest text-sm">
                <BarChart3 size={18} className="text-yellow-400" />
                Alunos por Modalidade
              </h3>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={classData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262626" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#737373' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#737373' }} />
                  <Tooltip 
                    cursor={{ fill: '#facc1510' }}
                    contentStyle={{ backgroundColor: '#000', border: '1px solid #262626', borderRadius: '12px', color: '#fff' }}
                  />
                  <Bar dataKey="alunos" fill="#facc15" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Students per Instructor Chart */}
        {selectedComponents.instructorChart && (
          <div className="bg-black p-6 rounded-2xl shadow-sm border border-neutral-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold flex items-center gap-2 text-white uppercase tracking-widest text-sm">
                <Users size={18} className="text-yellow-400" />
                Alunos por Instrutor
              </h3>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={instructorData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#262626" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#737373' }} />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#737373' }} width={100} />
                  <Tooltip 
                    cursor={{ fill: '#facc1510' }}
                    contentStyle={{ backgroundColor: '#000', border: '1px solid #262626', borderRadius: '12px', color: '#fff' }}
                  />
                  <Bar dataKey="value" fill="#f97316" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Overdue List */}
        {selectedComponents.overdueTable && (
          <div className="bg-black rounded-2xl shadow-sm border border-neutral-800 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
              <h3 className="font-bold flex items-center gap-2 text-white uppercase tracking-widest text-sm">
                <AlertCircle size={18} className="text-red-500" />
                Inadimplência (Vencidos)
              </h3>
              <span className="bg-red-950 text-red-400 text-[10px] font-bold px-2 py-1 rounded-full uppercase border border-red-400/20">
                {overdueStudents.length} Alunos
              </span>
            </div>
            <div className="flex-1 overflow-y-auto max-h-64 divide-y divide-neutral-800">
              {overdueStudents.length > 0 ? (
                overdueStudents.map(student => (
                  <div key={student.id} className="p-4 flex items-center justify-between hover:bg-neutral-900 transition-colors">
                    <div className="flex items-center gap-3">
                      <img src={student.photoUrl || `https://picsum.photos/seed/${student.id}/32/32`} className="w-8 h-8 rounded-full border border-neutral-800 object-cover" alt="" />
                      <div>
                        <p className="font-bold text-sm text-white">{student.name.toUpperCase()}</p>
                        <p className="text-xs text-red-400 flex items-center gap-1">
                          <Calendar size={10} /> Vencido em {format(new Date(student.nextPaymentDate), 'dd/MM/yyyy')}
                        </p>
                      </div>
                    </div>
                    <button className="text-xs font-bold text-yellow-400 hover:text-yellow-300 uppercase tracking-widest transition-colors">Cobrar</button>
                  </div>
                ))
              ) : (
                <div className="p-12 text-center text-neutral-500 italic text-sm">
                  Nenhum aluno com pagamento atrasado.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Summary Tables */}
      {selectedComponents.summaryTable && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-black rounded-2xl border border-neutral-800 overflow-hidden">
            <div className="p-4 bg-neutral-900 border-b border-neutral-800">
              <h3 className="text-xs font-bold text-white uppercase tracking-widest">Resumo por Modalidade</h3>
            </div>
            <table className="w-full text-xs text-left">
              <thead className="text-neutral-500 uppercase font-bold border-b border-neutral-800">
                <tr>
                  <th className="px-4 py-2">Aula</th>
                  <th className="px-4 py-2">Instrutor</th>
                  <th className="px-4 py-2 text-right">Alunos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {filteredClassesData.map(cls => (
                  <tr key={cls.id} className="hover:bg-neutral-900/50">
                    <td className="px-4 py-2 text-white font-bold">{cls.name}</td>
                    <td className="px-4 py-2 text-neutral-400">{cls.instructor}</td>
                    <td className="px-4 py-2 text-right text-yellow-400 font-bold">{cls.studentIds?.length || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-black rounded-2xl border border-neutral-800 overflow-hidden">
            <div className="p-4 bg-neutral-900 border-b border-neutral-800">
              <h3 className="text-xs font-bold text-white uppercase tracking-widest">Resumo por Instrutor</h3>
            </div>
            <table className="w-full text-xs text-left">
              <thead className="text-neutral-500 uppercase font-bold border-b border-neutral-800">
                <tr>
                  <th className="px-4 py-2">Instrutor</th>
                  <th className="px-4 py-2 text-right">Total Alunos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {instructorData.map(i => (
                  <tr key={i.name} className="hover:bg-neutral-900/50">
                    <td className="px-4 py-2 text-white font-bold">{i.name}</td>
                    <td className="px-4 py-2 text-right text-yellow-400 font-bold">{i.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Attendance List Section */}
      {selectedComponents.attendanceList && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-white italic uppercase tracking-tight flex items-center gap-2">
              <Users className="text-yellow-400" size={24} />
              Lista de Chamada (Simples)
            </h3>
            <div className="flex items-center gap-2">
              <button 
                onClick={printOnlyWithStudents}
                className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-blue-500 transition-colors uppercase tracking-widest shadow-lg shadow-blue-600/20"
                title="Imprimir apenas turmas que possuem alunos matriculados"
              >
                <Users size={16} /> Com Alunos
              </button>
              <button 
                onClick={printAllCallLists}
                className="bg-yellow-400 text-black px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-yellow-300 transition-colors uppercase tracking-widest shadow-lg shadow-yellow-400/20"
              >
                <Printer size={16} /> Imprimir Todas
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredClassesData
              .filter(cls => 
                !cls.name?.toLowerCase().includes('musculação') && 
                !cls.modality?.toLowerCase().includes('musculação')
              )
              .map(cls => {
                const enrolled = (cls.studentIds || []).map((sid: string) => 
                  students.find(s => s.id === sid)
                ).filter(Boolean);

              const scheduleText = cls.schedule && Object.keys(cls.schedule).length > 0
                ? Object.entries(cls.schedule).map(([day, times]: [string, any]) => 
                    `${day}: ${times.startTime}-${times.endTime}`
                  ).join(' | ')
                : (cls.daysOfWeek ? `${cls.daysOfWeek?.join(', ')} - ${cls.startTime || cls.time}` : 'Horário não definido');

              return (
                <div key={cls.id} className="bg-black rounded-2xl border border-neutral-800 overflow-hidden">
                  <div className="p-4 bg-neutral-900 border-b border-neutral-800 flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-white text-base">{cls.name}</h4>
                      <p className="text-[10px] text-yellow-400 font-bold uppercase tracking-widest">{cls.instructor}</p>
                      <p className="text-[9px] text-neutral-500 font-medium mt-1">{scheduleText}</p>
                    </div>
                    <button 
                      onClick={() => printCallList(cls)}
                      className="p-2 bg-black text-yellow-400 hover:bg-yellow-400/10 rounded-lg border border-neutral-800 transition-all"
                      title="Imprimir esta lista"
                    >
                      <Printer size={16} />
                    </button>
                  </div>
                  <div className="p-0 overflow-x-auto custom-scrollbar">
                    <table className="w-full text-xs min-w-[800px]">
                      <thead className="bg-neutral-950 text-neutral-500 uppercase font-bold text-[9px] border-b border-neutral-800">
                        <tr>
                          <th className="px-4 py-2 w-10">#</th>
                          <th className="px-4 py-2 w-48 text-left">Nome do Aluno</th>
                          {Array.from({ length: 31 }).map((_, i) => (
                            <th key={i} className="px-1 py-2 w-6 text-center border-l border-neutral-800">{i + 1}</th>
                          ))}
                          <th className="px-4 py-2 text-right w-20">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-800">
                        {enrolled.map((s, i) => (
                          <tr key={s.id} className="hover:bg-neutral-900/30">
                            <td className="px-4 py-2 text-neutral-600 font-mono">{i + 1}</td>
                            <td className="px-4 py-2 text-white font-medium truncate max-w-[12rem]">{(s.name || '').toUpperCase()}</td>
                            {Array.from({ length: 31 }).map((_, dayIdx) => {
                              const day = dayIdx + 1;
                              const dateStr = format(new Date(new Date().getFullYear(), new Date().getMonth(), day), 'yyyy-MM-dd');
                              const isPresent = attendance?.some(a => 
                                a.studentId === s.id && 
                                a.classId === cls.id && 
                                a.date === dateStr
                              );
                              
                              return (
                                <td key={dayIdx} className="px-1 py-2 border-l border-neutral-800 text-center">
                                  <div className={cn(
                                    "w-3 h-3 border rounded-sm mx-auto flex items-center justify-center",
                                    isPresent ? "bg-yellow-400 border-yellow-400" : "border-neutral-700"
                                  )}>
                                    {isPresent && <div className="w-1.5 h-1.5 bg-black rounded-full" />}
                                  </div>
                                </td>
                              );
                            })}
                            <td className="px-4 py-2 text-right">
                              <span className={cn(
                                "text-[9px] font-bold px-1.5 py-0.5 rounded uppercase",
                                s.status === 'active' ? "text-green-400 bg-green-400/10" : "text-red-400 bg-red-400/10"
                              )}>
                                {s.status === 'active' ? 'Ativo' : 'Inativo'}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {enrolled.length === 0 && (
                          <tr>
                            <td colSpan={3} className="px-4 py-8 text-center text-neutral-600 italic">
                              Nenhum aluno matriculado nesta turma.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Class Reports Section */}
      {selectedComponents.classDetails && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-white italic uppercase tracking-tight">Relatório de Turmas e Modalidades</h3>
            <div className="flex gap-2">
              <button 
                onClick={printSummaryReport}
                className="bg-neutral-900 text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-neutral-800 transition-colors border border-neutral-800 uppercase tracking-widest"
              >
                <BarChart3 size={16} /> Resumo Geral
              </button>
              <button 
                onClick={printAllCallLists}
                className="bg-neutral-900 text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-neutral-800 transition-colors border border-neutral-800 uppercase tracking-widest"
              >
                <Printer size={16} /> Todas as Listas
              </button>
              <button 
                onClick={() => window.print()}
                className="bg-neutral-900 text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-neutral-800 transition-colors border border-neutral-800 uppercase tracking-widest"
              >
                <Printer size={16} /> Imprimir Tela
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredClassesData
              .filter(cls => 
                !cls.name?.toLowerCase().includes('musculação') && 
                !cls.modality?.toLowerCase().includes('musculação')
              )
              .map(cls => (
                <div key={cls.id} className="bg-black rounded-2xl border border-neutral-800 overflow-hidden flex flex-col">
                <div className="p-4 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-white text-sm">{cls.name}</h4>
                    <p className="text-[10px] text-yellow-400 font-bold uppercase tracking-widest">{cls.modality || 'Geral'}</p>
                  </div>
                  <span className="bg-black text-neutral-400 text-[10px] font-bold px-2 py-1 rounded-lg border border-neutral-800">
                    {cls.studentIds?.length || 0} Alunos
                  </span>
                </div>
                <div className="p-4 flex-1 overflow-y-auto max-h-48 divide-y divide-neutral-800">
                  {cls.studentIds && cls.studentIds.length > 0 ? (
                    cls.studentIds.map((sid: string) => {
                      const student = students.find(s => s.id === sid);
                      return (
                        <div key={sid} className="py-2 flex items-center gap-3">
                          <img 
                            src={student?.photoUrl || `https://picsum.photos/seed/${sid}/24/24`} 
                            className="w-6 h-6 rounded-full border border-neutral-800 object-cover" 
                            alt="" 
                          />
                          <span className="text-xs text-neutral-300 truncate">{(student?.name || 'Aluno Desconhecido').toUpperCase()}</span>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-center py-4 text-[10px] text-neutral-600 italic">Nenhum aluno matriculado.</p>
                  )}
                </div>
                <div className="p-3 bg-neutral-950/50 border-t border-neutral-800 flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-neutral-500 font-bold uppercase">{cls.instructor}</span>
                    <span className="text-[9px] text-neutral-600 font-mono">
                      {cls.schedule ? Object.keys(cls.schedule).join(', ') : cls.daysOfWeek?.join(', ')}
                    </span>
                  </div>
                  <button 
                    onClick={() => printCallList(cls)}
                    className="p-2 text-yellow-400 hover:bg-yellow-400/10 rounded-lg transition-all"
                    title="Imprimir Lista de Chamada"
                  >
                    <Printer size={14} />
                  </button>
                </div>
              </div>
            ))}
            {filteredClassesData.length === 0 && (
              <div className="col-span-full p-12 text-center bg-black rounded-2xl border border-neutral-800 border-dashed">
                <p className="text-neutral-500 italic">Nenhuma turma selecionada para gerar relatórios.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
