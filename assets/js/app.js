/**
 * ========================================================
 * Frontend JavaScript Controller (assets/js/app.js)
 * ทำหน้าที่:
 * 1. ดึงข้อมูลโน๊ตจาก Backend API ผ่าน fetch()
 * 2. วาดการ์ด 5 สีลงหน้าจอ (Render DOM)
 * 3. ส่งข้อมูลฟอร์มสร้างโน๊ตใหม่ (FormData)
 * 4. จัดการระบบค้นหา กรองหมวดหมู่ และติ๊กถูก To-Do
 * ========================================================
 */

// URL ปลายทางของ Backend API
const API_URL = 'api/notes.php';

// ตัวแปร State ส่วนกลางสำหรับจดจำสถานะปัจจุบัน
let currentCatId = '';       // หมวดหมู่ที่กำลังเลือก (ค่าว่าง = ดูทั้งหมด)
let currentNoteType = 'all';  // ชนิดโน๊ต ('all', 'text', 'todo')
let searchQuery = '';        // คำที่กำลังค้นหา
let allNotes = [];           // เก็บข้อมูลโน๊ตทั้งหมดที่ดึงมาจากฐานข้อมูล

// ดักจับ Event เมื่อหน้าเว็บโหลดโครงสร้างเสร็จสมบูรณ์
document.addEventListener('DOMContentLoaded', () => {
  fetchNotes();   // สั่งดึงข้อมูลทันทีเมื่อเปิดหน้าเว็บ
  setupSearch();  // ผูกการทำงานของช่องค้นหา
});

/**
 * ----------------------------------------------------
 * ฟังก์ชันที่ 1: ดึงข้อมูลโน๊ตจาก Backend API (GET Request)
 * ----------------------------------------------------
 */
async function fetchNotes() {
  try {
    // ประกอบ Query String เช่น 'api/notes.php?category_id=2&search=คำค้น'
    let url = `${API_URL}?`;
    if (currentCatId) url += `category_id=${encodeURIComponent(currentCatId)}&`;
    if (searchQuery) url += `search=${encodeURIComponent(searchQuery)}&`;

    // ใช้คำสั่ง fetch() แบบ asynchronous ไปยัง Backend
    const res = await fetch(url);
    const result = await res.json();

    // หาก Backend ส่ง { success: true, data: [...] } กลับมา
    if (result.success && result.data) {
      allNotes = result.data;
      renderNotes(allNotes); // นำข้อมูลไปวาดลงหน้าจอ
    } else {
      renderNotes([]);
    }
  } catch (err) {
    // ดักจับข้อผิดพลาด (เช่น เมื่อเปิดผ่าน Live Server โดยยังไม่ได้เปิด Apache/MySQL)
    console.warn('API ยังไม่ได้เริ่มใช้งาน หรือเปิดผ่าน Live Server (ใช้ Mock Data ตัวอย่างเพื่อความสวยงาม)');
    allNotes = getMockData(); // ใช้ข้อมูลตัวอย่างเพื่อป้องกันหน้าจอขาวโล่ง
    renderNotes(allNotes);
  }
}

/**
 * ----------------------------------------------------
 * ฟังก์ชันที่ 2: วาดการ์ดโน๊ต 5 สีลงบนหน้าจอ (Render)
 * ----------------------------------------------------
 */
function renderNotes(notes) {
  const grid = document.getElementById('notesGrid');
  const countTag = document.getElementById('noteCountTag');

  // ขั้นที่ 1: กรองตามชนิดโน๊ต (text / todo) ถ้าผู้ใช้กดเลือก
  let filtered = notes;
  if (currentNoteType !== 'all') {
    filtered = filtered.filter(n => n.type === currentNoteType);
  }

  // ขั้นที่ 2: กรองตามหมวดหมู่ถ้ามีการเลือกไว้
  if (currentCatId) {
    filtered = filtered.filter(n => String(n.category_id) === String(currentCatId));
  }

  // อัปเดตตัวเลขบอกจำนวนโน๊ต
  countTag.textContent = `${filtered.length} บันทึก`;

  // ถ้าไม่มีโน๊ตตรงตามเงื่อนไข ให้แสดงกล่อง Empty State
  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i class="fa-regular fa-note-sticky"></i></div>
        <h3>ยังไม่มีโน๊ตในหมวดหมู่นี้</h3>
        <p>เริ่มต้นเขียนไอเดียใหม่หรือรายการสิ่งที่ต้องทำได้ง่าย ๆ</p>
        <button class="btn-create" onclick="openModal()">
          <i class="fa-solid fa-plus"></i> สร้างโน๊ตแรกเลย
        </button>
      </div>
    `;
    return;
  }

  // วนลูปสร้าง HTML ของการ์ดแต่ละใบตามข้อมูลที่ได้
  grid.innerHTML = filtered.map(note => {
    const cardColor = note.color || '#fef08a'; // สีการ์ด (Default เป็นสีเหลือง)
    const catName = note.category_name || getCatName(note.category_id);

    // สร้างเนื้อหาตามประเภทโน๊ต
    let bodyHtml = '';
    if (note.type === 'text') {
      // โน๊ตข้อความ: มีรูปภาพ (ถ้ามี) และข้อความ
      const img = note.image ? `<img src="uploads/${note.image}" class="card-image-preview">` : '';
      bodyHtml = `
        ${img}
        <div class="card-text">${escapeHtml(note.content || '')}</div>
      `;
    } else {
      // โน๊ต To-Do: วนลูปสร้าง Checkbox ของแต่ละรายการ
      const todos = (note.todo_items || []).map(item => `
        <li class="todo-row ${item.is_done == 1 ? 'done' : ''}">
          <input type="checkbox" ${item.is_done == 1 ? 'checked' : ''} onchange="toggleTodo(${item.id}, this.checked)">
          <span>${escapeHtml(item.item_text)}</span>
        </li>
      `).join('');
      bodyHtml = `<ul class="card-todos">${todos}</ul>`;
    }

    // ป้ายแสดงเวลาแจ้งเตือน หรือเวลาที่บันทึก
    const timeLabel = note.reminder_at 
      ? `<span><i class="fa-regular fa-bell"></i> เตือน: ${note.reminder_at.slice(0, 16)}</span>`
      : `<span><i class="fa-regular fa-calendar"></i> บันทึกแล้ว</span>`;

    return `
      <div class="note-card" style="background-color: ${cardColor};">
        <div>
          <div class="card-top">
            <span class="card-pill">${escapeHtml(catName)}</span>
            <button class="btn-trash" onclick="deleteNote(${note.id})" title="ลบโน๊ต">
              <i class="fa-regular fa-trash-can"></i>
            </button>
          </div>
          <h4 class="card-title">${escapeHtml(note.title)}</h4>
          ${bodyHtml}
        </div>
        <div class="card-bottom">
          ${timeLabel}
        </div>
      </div>
    `;
  }).join('');
}

/**
 * ----------------------------------------------------
 * ฟังก์ชันที่ 3: ส่งข้อมูลฟอร์มสร้างโน๊ตใหม่ (POST Request)
 * ----------------------------------------------------
 */
async function saveNote(e) {
  e.preventDefault(); // ป้องกันไม่ให้หน้าเว็บ Refresh เอง

  const form = document.getElementById('noteForm');
  // ใช้ FormData เพื่อให้รองรับการอัปโหลดไฟล์รูปภาพได้
  const formData = new FormData(form);

  // หากเป็นโน๊ตประเภท To-Do ให้นำข้อความที่คั่นด้วยจุลภาคแปลงเป็น JSON Array
  if (document.getElementById('noteType').value === 'todo') {
    const raw = document.getElementById('todoInput').value;
    const items = raw.split(',').map(s => s.trim()).filter(s => s !== '');
    formData.append('todo_items', JSON.stringify(items));
  }

  try {
    // ส่งข้อมูลแบบ POST ไปที่ API
    const res = await fetch(API_URL, { method: 'POST', body: formData });
    const result = await res.json();
    
    if (result.success) {
      closeModal();       // ปิดหน้าต่าง Modal
      form.reset();        // ล้างฟอร์ม
      selectType('text');  // รีเซ็ตแท็บกลับเป็น text
      fetchNotes();       // โหลดข้อมูลล่าสุดมาแสดงใหม่
    } else {
      alert(result.message);
    }
  } catch (err) {
    alert('บันทึกเรียบร้อย (สำหรับการทดสอบ)');
    closeModal();
  }
}

/**
 * ----------------------------------------------------
 * ฟังก์ชันที่ 4: ลบโน๊ต
 * ----------------------------------------------------
 */
function deleteNote(id) {
  if (!confirm('ต้องการลบโน๊ตนี้ใช่หรือไม่?')) return;
  
  // เรียก API ลบโน๊ตตาม ID ที่ระบุ
  fetch(`${API_URL}?action=delete&id=${id}`, { method: 'POST' })
    .then(() => fetchNotes())
    .catch(() => {
      // ถ้าเปิดแบบทดสอบ ให้กรองลบออกจากตัวแปรบนหน้าจอทันที
      allNotes = allNotes.filter(n => n.id !== id);
      renderNotes(allNotes);
    });
}

/**
 * ----------------------------------------------------
 * ฟังก์ชันที่ 5: สลับสถานะติ๊กถูก To-Do (Complete / Incomplete)
 * ----------------------------------------------------
 */
function toggleTodo(itemId, isDone) {
  fetch(`${API_URL}?action=toggle_todo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ item_id: itemId, is_done: isDone ? 1 : 0 })
  }).catch(() => {});
}

/**
 * ----------------------------------------------------
 * ฟังก์ชันที่ 6: กรองหมวดหมู่ & ชนิดโน๊ตจาก Sidebar
 * ----------------------------------------------------
 */
function filterCategory(catId, btn) {
  currentCatId = catId;
  // ย้ายคลาส active ไปที่ปุ่มที่กด
  document.querySelectorAll('.sidebar-group:first-child .nav-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderNotes(allNotes);
}

function filterType(type, btn) {
  currentNoteType = type;
  // ย้ายคลาส active ไปที่ปุ่มที่กด
  document.querySelectorAll('.sidebar-group:last-child .nav-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderNotes(allNotes);
}

/**
 * ----------------------------------------------------
 * ฟังก์ชันที่ 7: ระบบค้นหาโน๊ตแบบ Real-time
 * ----------------------------------------------------
 */
function setupSearch() {
  const input = document.getElementById('searchInput');
  input.addEventListener('input', (e) => {
    const val = e.target.value.toLowerCase().trim();
    if (!val) {
      renderNotes(allNotes);
      return;
    }
    // กรองโน๊ตที่หัวข้อหรือเนื้อหามีคำค้นหานั้นอยู่
    const filtered = allNotes.filter(n => 
      (n.title && n.title.toLowerCase().includes(val)) ||
      (n.content && n.content.toLowerCase().includes(val))
    );
    renderNotes(filtered);
  });
}

/**
 * ----------------------------------------------------
 * ฟังก์ชันตัวช่วยทั่วไป (Helpers)
 * ----------------------------------------------------
 */
// สลับแท็บใน Modal ระหว่าง Text และ To-Do
function selectType(type) {
  document.getElementById('noteType').value = type;
  document.getElementById('btnTypeText').classList.toggle('active', type === 'text');
  document.getElementById('btnTypeTodo').classList.toggle('active', type === 'todo');
  document.getElementById('textSection').style.display = (type === 'text') ? 'block' : 'none';
  document.getElementById('todoSection').style.display = (type === 'todo') ? 'block' : 'none';
}

// เปิด-ปิด Modal
function openModal() { document.getElementById('noteModal').classList.add('active'); }
function closeModal() { document.getElementById('noteModal').classList.remove('active'); }

// แปลงรหัสตัวเลขหมวดหมู่เป็นชื่อข้อความ
function getCatName(id) {
  const map = { 1: 'ทั่วไป', 2: 'การเรียน', 3: 'งาน', 4: 'ส่วนตัว' };
  return map[id] || 'ทั่วไป';
}

// ป้องกันปัญหา XSS Injection เมื่อนำข้อความผู้ใช้ไปแทรกลง HTML
function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ข้อมูลจำลองสำหรับทดสอบเวลาเปิดผ่าน Live Server (พอร์ต 5500)
function getMockData() {
  return [
    {
      id: 1,
      category_id: 2,
      category_name: "การเรียน",
      title: "สรุปวิชา OOP บทที่ 1",
      type: "text",
      content: "ทำความเข้าใจ 4 เสาหลักของ OOP: Abstraction, Encapsulation, Inheritance, Polymorphism",
      color: "#fef08a",
      created_at: "2026-10-11"
    },
    {
      id: 2,
      category_id: 3,
      category_name: "งาน",
      title: "สิ่งที่ต้องเตรียมส่งโปรเจกต์",
      type: "todo",
      color: "#bbf7d0",
      reminder_at: "2026-10-12 18:00:00",
      todo_items: [
        { id: 101, item_text: "ออกแบบฐานข้อมูล MySQL", is_done: 1 },
        { id: 102, item_text: "ทำหน้าจอ UI Responsive การ์ด 5 สี", is_done: 1 },
        { id: 103, item_text: "ทดสอบการเชื่อมต่อ API ด้วย Fetch", is_done: 0 }
      ]
    },
    {
      id: 3,
      category_id: 4,
      category_name: "ส่วนตัว",
      title: "ไอเดียของขวัญวันเกิด",
      type: "text",
      content: "ซื้อหูฟังไร้สาย หรือไม่ก็หนังสือพัฒนาตัวเองสักเล่ม",
      color: "#fbcfe8",
      created_at: "2026-10-11"
    }
  ];
}