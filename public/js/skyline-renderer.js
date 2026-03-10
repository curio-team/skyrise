class SkylineRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.students = [];
    this.totalLevels = 10;
    this.selectedStudent = null;
    
    // Set up canvas sizing
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * window.devicePixelRatio;
    this.canvas.height = rect.height * window.devicePixelRatio;
    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    this.width = rect.width;
    this.height = rect.height;
    this.draw();
  }

  setStudents(students, totalLevels) {
    this.students = students;
    this.totalLevels = totalLevels || 10;
    this.draw();
  }

  setSelectedStudent(studentId) {
    this.selectedStudent = studentId;
    this.draw();
  }

  draw() {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Draw sky gradient
    const skyGradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
    skyGradient.addColorStop(0, '#87CEEB');
    skyGradient.addColorStop(1, '#E0F6FF');
    this.ctx.fillStyle = skyGradient;
    this.ctx.fillRect(0, 0, this.width, this.height);

    if (this.students.length === 0) {
      this.drawEmptyState();
      return;
    }

    // Draw ground
    const groundHeight = 40;
    this.ctx.fillStyle = '#2d3436';
    this.ctx.fillRect(0, this.height - groundHeight, this.width, groundHeight);

    // Calculate building dimensions
    const padding = 20;
    const spacing = 10;
    const availableWidth = this.width - (padding * 2);
    const buildingWidth = Math.min(
      80,
      (availableWidth - (spacing * (this.students.length - 1))) / this.students.length
    );
    const maxBuildingHeight = this.height - groundHeight - 60;

    // Draw buildings
    this.students.forEach((student, index) => {
      const x = padding + (index * (buildingWidth + spacing));
      const levelHeight = maxBuildingHeight / this.totalLevels;
      const height = student.current_level > 1 
        ? (student.current_level - 1) * levelHeight 
        : levelHeight * 0.3; // Show small base for level 1
      const y = this.height - groundHeight - height;

      // Building shadow
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      this.ctx.fillRect(x + 3, y + 3, buildingWidth, height);

      // Building
      const isSelected = this.selectedStudent === student.id;
      if (isSelected) {
        this.ctx.strokeStyle = '#FFD700';
        this.ctx.lineWidth = 4;
        this.ctx.strokeRect(x - 2, y - 2, buildingWidth + 4, height + 4);
      }

      this.ctx.fillStyle = student.color;
      this.ctx.fillRect(x, y, buildingWidth, height);

      // Building windows (simple pattern)
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      const windowRows = Math.floor(height / 20);
      const windowCols = Math.floor(buildingWidth / 15);
      for (let row = 0; row < windowRows; row++) {
        for (let col = 0; col < windowCols; col++) {
          const wx = x + 5 + (col * 15);
          const wy = y + 5 + (row * 20);
          this.ctx.fillRect(wx, wy, 8, 12);
        }
      }

      // Level indicator on building
      this.ctx.fillStyle = 'white';
      this.ctx.font = 'bold 16px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      const levelText = student.current_level - 1 || '0';
      this.ctx.fillText(levelText, x + buildingWidth / 2, y + Math.max(height / 2, 15));

      // Student name label above building
      const nameLabel = student.name;
      this.ctx.font = 'bold 13px sans-serif';
      const nameWidth = this.ctx.measureText(nameLabel).width;
      const labelPad = 8;
      const labelW = nameWidth + labelPad * 2;
      const labelH = 22;
      const labelX = x + buildingWidth / 2 - labelW / 2;
      const labelY = y - labelH - 6;

      // Label background
      this.ctx.fillStyle = isSelected ? '#FFD700' : 'rgba(255,255,255,0.92)';
      this.ctx.beginPath();
      this.ctx.roundRect(labelX, labelY, labelW, labelH, 4);
      this.ctx.fill();

      // Label text
      this.ctx.fillStyle = '#2d3436';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(nameLabel, x + buildingWidth / 2, labelY + labelH / 2);

      // Level below building
      this.ctx.font = 'bold 11px sans-serif';
      this.ctx.fillStyle = '#ffffff';
      this.ctx.textBaseline = 'top';
      this.ctx.fillText(
        `Lvl ${student.current_level - 1}`,
        x + buildingWidth / 2,
        this.height - groundHeight + 8
      );
    });

    // Draw title
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    this.ctx.font = 'bold 24px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'top';
    this.ctx.fillText('Our City Skyline', this.width / 2, 20);
  }

  drawEmptyState() {
    this.ctx.fillStyle = '#636e72';
    this.ctx.font = '20px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('Waiting for students to join...', this.width / 2, this.height / 2);
  }

  getStudentAtPosition(x, y) {
    const rect = this.canvas.getBoundingClientRect();
    const clickX = x - rect.left;
    const clickY = y - rect.top;

    const padding = 20;
    const spacing = 10;
    const availableWidth = this.width - (padding * 2);
    const buildingWidth = Math.min(
      80,
      (availableWidth - (spacing * (this.students.length - 1))) / this.students.length
    );
    const groundHeight = 40;
    const maxBuildingHeight = this.height - groundHeight - 60;

    for (let i = 0; i < this.students.length; i++) {
      const student = this.students[i];
      const bx = padding + (i * (buildingWidth + spacing));
      const levelHeight = maxBuildingHeight / this.totalLevels;
      const height = student.current_level > 1 
        ? (student.current_level - 1) * levelHeight 
        : levelHeight * 0.3;
      const by = this.height - groundHeight - height;

      if (clickX >= bx && clickX <= bx + buildingWidth && clickY >= by && clickY <= by + height) {
        return student;
      }
    }

    return null;
  }
}
