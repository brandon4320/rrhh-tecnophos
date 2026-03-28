-- ============================================================
-- SEED — Personal y vehículos del Excel original
-- Ejecutar después del schema.sql
-- ============================================================

-- ---- TECNOPHOS BAHÍA BLANCA ----
do $$
declare
  eid_bb uuid;
  emp_id uuid;
  t_carnet uuid;
  t_aplicador uuid;
  t_portuario uuid;
  t_medicos uuid;
  t_induccion_tbb uuid;
  t_cargill uuid;
  t_unipar uuid;
  t_viterra uuid;
  t_tmercpel uuid;
  t_autoelevadores uuid;
begin
  select id into eid_bb from empresas where slug = 'tecnophos-bb';
  select id into t_carnet from tipos_certificado where nombre = 'Carnet de Conducir';
  select id into t_aplicador from tipos_certificado where nombre = 'Carnet de Aplicador';
  select id into t_portuario from tipos_certificado where nombre = 'Carnet de Personal Portuario';
  select id into t_medicos from tipos_certificado where nombre = 'Exámenes Médicos';
  select id into t_induccion_tbb from tipos_certificado where nombre = 'Curso Inducción TBB';
  select id into t_cargill from tipos_certificado where nombre = 'Curso Cargill';
  select id into t_unipar from tipos_certificado where nombre = 'Curso Unipar';
  select id into t_viterra from tipos_certificado where nombre = 'Curso Viterra';
  select id into t_tmercpel from tipos_certificado where nombre = 'Habilitación Transporte Mercancías Peligrosas';
  select id into t_autoelevadores from tipos_certificado where nombre = 'Curso Autoelevadores';

  -- Aquino Gabriel
  insert into empleados (nombre, empresa_id) values ('Aquino Gabriel', eid_bb) returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_carnet,   emp_id, '2027-11-16'),
    (t_aplicador,emp_id, '2027-06-12'),
    (t_medicos,  emp_id, '2027-01-21'),
    (t_viterra,  emp_id, '2027-09-17');

  -- Garay Mauro
  insert into empleados (nombre, empresa_id) values ('Garay Mauro', eid_bb) returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_carnet,        emp_id, '2027-02-03'),
    (t_aplicador,     emp_id, '2027-11-25'),
    (t_medicos,       emp_id, '2026-04-24'),
    (t_induccion_tbb, emp_id, '2027-02-04'),
    (t_unipar,        emp_id, '2027-05-22'),
    (t_viterra,       emp_id, '2027-11-19');

  -- Muñoz Franco Emanuel
  insert into empleados (nombre, empresa_id) values ('Muñoz Franco Emanuel', eid_bb) returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_carnet,        emp_id, '2031-01-07'),
    (t_aplicador,     emp_id, '2028-02-03'),
    (t_portuario,     emp_id, '2027-04-27'),
    (t_medicos,       emp_id, '2026-08-07'),
    (t_induccion_tbb, emp_id, '2026-11-12'),
    (t_unipar,        emp_id, '2027-10-22'),
    (t_viterra,       emp_id, '2026-11-18');

  -- Risso Ludmila
  insert into empleados (nombre, empresa_id) values ('Risso Ludmila', eid_bb) returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_carnet,        emp_id, '2029-12-26'),
    (t_aplicador,     emp_id, '2028-09-19'),
    (t_medicos,       emp_id, '2026-08-29'),
    (t_induccion_tbb, emp_id, '2026-09-10'),
    (t_unipar,        emp_id, '2027-05-21');

  -- Braian Risso Matias
  insert into empleados (nombre, empresa_id) values ('Braian Risso Matias', eid_bb) returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_carnet,        emp_id, '2026-05-31'),
    (t_aplicador,     emp_id, '2027-10-29'),
    (t_portuario,     emp_id, '2026-12-09'),
    (t_medicos,       emp_id, '2026-08-21'),
    (t_induccion_tbb, emp_id, '2026-03-19'),
    (t_unipar,        emp_id, '2027-09-24'),
    (t_viterra,       emp_id, '2026-08-19');

  -- Gonzalez Heber
  insert into empleados (nombre, empresa_id) values ('Gonzalez Heber', eid_bb) returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_aplicador,     emp_id, '2027-09-04'),
    (t_portuario,     emp_id, '2027-01-26'),
    (t_medicos,       emp_id, '2026-04-10'),
    (t_induccion_tbb, emp_id, '2027-02-11'),
    (t_cargill,       emp_id, '2026-03-27'),
    (t_unipar,        emp_id, '2026-10-16');

  -- Kolecsnik Damian Nicolas
  insert into empleados (nombre, empresa_id) values ('Kolecsnik Damian Nicolas', eid_bb) returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_carnet,        emp_id, '2028-10-27'),
    (t_aplicador,     emp_id, '2027-09-12'),
    (t_portuario,     emp_id, '2029-03-14'),
    (t_medicos,       emp_id, '2026-12-15'),
    (t_induccion_tbb, emp_id, '2027-03-11'),
    (t_unipar,        emp_id, '2027-12-03'),
    (t_viterra,       emp_id, '2027-02-03');

  -- Lamonica Rodolfo Nicolas
  insert into empleados (nombre, empresa_id) values ('Lamonica Rodolfo Nicolas', eid_bb) returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_carnet,            emp_id, '2028-02-23'),
    (t_aplicador,         emp_id, '2028-02-18'),
    (t_medicos,           emp_id, '2026-12-19'),
    (t_unipar,            emp_id, '2027-09-24'),
    (t_viterra,           emp_id, '2026-08-19'),
    (t_tmercpel,          emp_id, '2026-03-25'),
    (t_autoelevadores,    emp_id, '2026-08-26');

  -- Nicolas Monzon
  insert into empleados (nombre, empresa_id) values ('Nicolas Monzon', eid_bb) returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_carnet,        emp_id, '2028-11-21'),
    (t_portuario,     emp_id, '2026-09-03'),
    (t_medicos,       emp_id, '2027-01-06'),
    (t_induccion_tbb, emp_id, '2026-05-28'),
    (t_unipar,        emp_id, '2026-10-23'),
    (t_viterra,       emp_id, '2026-09-30');

  -- Solange Micaela Antinao
  insert into empleados (nombre, empresa_id) values ('Solange Micaela Antinao', eid_bb) returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_carnet,        emp_id, '2030-07-04'),
    (t_medicos,       emp_id, '2026-12-09'),
    (t_induccion_tbb, emp_id, '2026-12-22');

  -- Montenegro Antonella
  insert into empleados (nombre, empresa_id) values ('Montenegro Antonella', eid_bb) returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_carnet,        emp_id, '2027-09-09'),
    (t_medicos,       emp_id, '2026-05-28'),
    (t_induccion_tbb, emp_id, '2026-05-21'),
    (t_unipar,        emp_id, '2027-09-03'),
    (t_viterra,       emp_id, '2026-06-17');

  -- Rojas Brian Nicolas
  insert into empleados (nombre, empresa_id) values ('Rojas Brian Nicolas', eid_bb) returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_medicos,       emp_id, '2026-04-25'),
    (t_induccion_tbb, emp_id, '2026-07-10'),
    (t_cargill,       emp_id, '2027-07-31'),
    (t_unipar,        emp_id, '2027-09-03');
end $$;

-- ---- VEHÍCULOS BAHÍA BLANCA ----
do $$
declare eid uuid;
begin
  select id into eid from empresas where slug = 'tecnophos-bb';
  insert into vehiculos (patente, empresa_id) values
    ('AD735XJ', eid), ('AE169KB', eid), ('AD113UY', eid), ('AG491JU', eid), ('AH797GK', eid);
end $$;

-- ---- TECNOPHOS ROSARIO ----
do $$
declare
  eid uuid;
  emp_id uuid;
  t_aplicador uuid; t_portuario uuid; t_medicos uuid;
  t_bunge_pgsm uuid; t_bunge_ramallo uuid; t_gral_bunge uuid;
  t_cofco uuid; t_renova uuid; t_terminal6 uuid; t_cargill_ro uuid;
  t_tmercpel uuid; t_autoelevadores uuid;
begin
  select id into eid from empresas where slug = 'tecnophos-rosario';
  select id into t_aplicador from tipos_certificado where nombre = 'Carnet de Aplicador';
  select id into t_portuario from tipos_certificado where nombre = 'Carnet de Personal Portuario';
  select id into t_medicos from tipos_certificado where nombre = 'Exámenes Médicos';
  select id into t_bunge_pgsm from tipos_certificado where nombre = 'Inducción Bunge PGSM';
  select id into t_bunge_ramallo from tipos_certificado where nombre = 'Inducción Bunge Ramallo';
  select id into t_gral_bunge from tipos_certificado where nombre = 'Inducción Gral Bunge';
  select id into t_cofco from tipos_certificado where nombre = 'Inducción Cofco';
  select id into t_renova from tipos_certificado where nombre = 'Inducción Renova';
  select id into t_terminal6 from tipos_certificado where nombre = 'Inducción Terminal 6';
  select id into t_cargill_ro from tipos_certificado where nombre = 'Inducción Cargill Rosario';
  select id into t_tmercpel from tipos_certificado where nombre = 'Habilitación Transporte Mercancías Peligrosas';
  select id into t_autoelevadores from tipos_certificado where nombre = 'Curso Autoelevadores';

  -- ARANDA DANIEL ALFREDO
  insert into empleados (nombre, empresa_id) values ('Aranda Daniel Alfredo', eid) returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_medicos,      emp_id, '2026-04-08'), (t_bunge_pgsm,   emp_id, '2026-07-01'),
    (t_bunge_ramallo,emp_id, '2026-07-01'), (t_cofco,        emp_id, '2026-12-03'),
    (t_renova,       emp_id, '2026-06-03');

  -- BIANCOTTI RICARDO ROMAN
  insert into empleados (nombre, empresa_id) values ('Biancotti Ricardo Roman', eid) returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_medicos,       emp_id, '2026-06-06'), (t_bunge_pgsm,   emp_id, '2026-08-28'),
    (t_bunge_ramallo, emp_id, '2026-04-28'), (t_gral_bunge,   emp_id, '2026-08-06'),
    (t_cofco,         emp_id, '2026-11-18'), (t_renova,        emp_id, '2026-07-22');

  -- CABELLO ALEXIS ADEMIR
  insert into empleados (nombre, empresa_id) values ('Cabello Alexis Ademir', eid) returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_medicos,       emp_id, '2026-05-05'), (t_bunge_pgsm,   emp_id, '2026-05-30'),
    (t_bunge_ramallo, emp_id, '2026-04-28'), (t_gral_bunge,   emp_id, '2026-05-26'),
    (t_cofco,         emp_id, '2026-05-07'), (t_renova,        emp_id, '2026-06-25');

  -- CACERES CRISTIAN MAXIMILIANO
  insert into empleados (nombre, empresa_id) values ('Caceres Cristian Maximiliano', eid) returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_portuario,     emp_id, '2027-07-04'), (t_medicos,       emp_id, '2026-08-04'),
    (t_bunge_pgsm,    emp_id, '2027-03-17'), (t_gral_bunge,    emp_id, '2027-01-19'),
    (t_cofco,         emp_id, '2026-12-03'), (t_renova,        emp_id, '2026-09-29');

  -- DADAMO ALEXIS ALEJANDRO
  insert into empleados (nombre, empresa_id) values ('Dadamo Alexis Alejandro', eid) returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_medicos,       emp_id, '2026-06-17'), (t_bunge_pgsm,   emp_id, '2026-03-11'),
    (t_gral_bunge,    emp_id, '2026-08-06'), (t_cofco,        emp_id, '2026-10-30'),
    (t_renova,        emp_id, '2026-07-22');

  -- DIAZ LUCAS JOEL
  insert into empleados (nombre, empresa_id) values ('Diaz Lucas Joel', eid) returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_aplicador,     emp_id, '2027-09-10'), (t_bunge_pgsm,   emp_id, '2026-04-01'),
    (t_gral_bunge,    emp_id, '2026-10-29'), (t_cofco,        emp_id, '2026-01-02'),
    (t_renova,        emp_id, '2026-02-10');

  -- FEDERICI MICHEL ALEXANDER
  insert into empleados (nombre, empresa_id) values ('Federici Michel Alexander', eid) returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_aplicador,     emp_id, '2026-10-02'), (t_medicos,       emp_id, '2026-11-17'),
    (t_bunge_pgsm,    emp_id, '2027-03-03'), (t_gral_bunge,    emp_id, '2027-01-19'),
    (t_cofco,         emp_id, '2027-02-12'), (t_renova,        emp_id, '2026-02-10');

  -- GALLUCCI BRUNO EDUARDO
  insert into empleados (nombre, empresa_id) values ('Gallucci Bruno Eduardo', eid) returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_aplicador,     emp_id, '2026-10-02'), (t_medicos,       emp_id, '2026-09-16'),
    (t_bunge_pgsm,    emp_id, '2026-09-02'), (t_bunge_ramallo, emp_id, '2026-04-28'),
    (t_gral_bunge,    emp_id, '2026-10-22'), (t_cofco,         emp_id, '2026-12-03'),
    (t_renova,        emp_id, '2027-02-03');

  -- GALLUCCI LUCAS MARTIN
  insert into empleados (nombre, empresa_id) values ('Gallucci Lucas Martin', eid) returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_medicos,       emp_id, '2026-11-27'), (t_bunge_pgsm,   emp_id, '2026-12-23'),
    (t_gral_bunge,    emp_id, '2026-12-11'), (t_cofco,        emp_id, '2027-01-07'),
    (t_renova,        emp_id, '2026-03-31');

  -- GONELLA OSCAR JESUS
  insert into empleados (nombre, empresa_id) values ('Gonella Oscar Jesus', eid) returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_medicos,       emp_id, '2026-04-17'), (t_bunge_pgsm,   emp_id, '2026-05-30'),
    (t_gral_bunge,    emp_id, '2026-04-30'), (t_cofco,        emp_id, '2026-05-07'),
    (t_renova,        emp_id, '2026-05-13');

  -- GUTIERREZ BOSSO FERNANDO LAUTARO
  insert into empleados (nombre, empresa_id) values ('Gutierrez Bosso Fernando Lautaro', eid) returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_aplicador,     emp_id, '2027-09-10'), (t_medicos,       emp_id, '2026-12-10'),
    (t_bunge_pgsm,    emp_id, '2026-10-14'), (t_bunge_ramallo, emp_id, '2026-04-28'),
    (t_gral_bunge,    emp_id, '2027-01-19'), (t_cofco,         emp_id, '2026-11-26'),
    (t_renova,        emp_id, '2026-04-15');

  -- HERRERA CRISTIAN ARIEL
  insert into empleados (nombre, empresa_id) values ('Herrera Cristian Ariel', eid) returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_aplicador,     emp_id, '2027-09-10'), (t_portuario,     emp_id, '2027-01-10'),
    (t_medicos,       emp_id, '2027-02-23'), (t_bunge_pgsm,    emp_id, '2026-10-07'),
    (t_bunge_ramallo, emp_id, '2026-04-28'), (t_gral_bunge,    emp_id, '2027-03-04'),
    (t_cofco,         emp_id, '2026-11-26'), (t_renova,        emp_id, '2026-03-25'),
    (t_tmercpel,      emp_id, '2026-03-14');

  -- LEIVA IVAN MATIAS
  insert into empleados (nombre, empresa_id) values ('Leiva Ivan Matias', eid) returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_medicos,       emp_id, '2026-12-09'), (t_bunge_pgsm,   emp_id, '2026-09-16'),
    (t_gral_bunge,    emp_id, '2027-03-04'), (t_cofco,        emp_id, '2026-12-17'),
    (t_renova,        emp_id, '2026-10-28');

  -- LIOI ELIAS JAVIER
  insert into empleados (nombre, empresa_id) values ('Lioi Elias Javier', eid) returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_medicos,       emp_id, '2027-02-24'), (t_bunge_pgsm,   emp_id, '2026-02-11'),
    (t_gral_bunge,    emp_id, '2026-04-07'), (t_cofco,        emp_id, '2026-04-03'),
    (t_renova,        emp_id, '2026-12-21');

  -- LOPEZ GUSTAVO ANDRES
  insert into empleados (nombre, empresa_id) values ('Lopez Gustavo Andres', eid) returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_medicos,       emp_id, '2026-12-11'), (t_bunge_pgsm,   emp_id, '2027-03-10'),
    (t_gral_bunge,    emp_id, '2027-02-24'), (t_cofco,        emp_id, '2026-11-12'),
    (t_renova,        emp_id, '2026-07-22');

  -- More employees (abbreviated for seed)
  -- MARTINEZ GIAN FRANCO
  insert into empleados (nombre, empresa_id) values ('Martinez Gian Franco', eid) returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_aplicador,     emp_id, '2027-09-10'), (t_portuario,     emp_id, '2027-04-06'),
    (t_medicos,       emp_id, '2026-10-13'), (t_bunge_pgsm,    emp_id, '2026-11-04'),
    (t_gral_bunge,    emp_id, '2026-08-13'), (t_cofco,         emp_id, '2026-04-30'),
    (t_renova,        emp_id, '2026-06-26');

  -- MERCAU JUAN ROLANDO
  insert into empleados (nombre, empresa_id) values ('Mercau Juan Rolando', eid) returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_aplicador,     emp_id, '2027-09-10'), (t_portuario,     emp_id, '2027-06-07'),
    (t_medicos,       emp_id, '2026-04-21'), (t_bunge_pgsm,    emp_id, '2026-08-26'),
    (t_bunge_ramallo, emp_id, '2026-08-26'), (t_gral_bunge,    emp_id, '2027-01-29'),
    (t_cofco,         emp_id, '2026-11-26'), (t_renova,        emp_id, '2026-11-11'),
    (t_tmercpel,      emp_id, '2026-12-12');

  -- VILLALBA JUAN RAMON
  insert into empleados (nombre, empresa_id) values ('Villalba Juan Ramon', eid) returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_aplicador,     emp_id, '2027-09-10'), (t_medicos,       emp_id, '2027-02-25'),
    (t_bunge_pgsm,    emp_id, '2027-03-17'), (t_gral_bunge,    emp_id, '2026-03-26'),
    (t_cofco,         emp_id, '2026-04-03'), (t_renova,        emp_id, '2026-05-20');

  -- ZABALA JUAN LEONARDO
  insert into empleados (nombre, empresa_id) values ('Zabala Juan Leonardo', eid) returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_aplicador,     emp_id, '2027-09-10'), (t_medicos,       emp_id, '2027-02-06'),
    (t_bunge_pgsm,    emp_id, '2026-11-11'), (t_gral_bunge,    emp_id, '2026-03-26'),
    (t_cofco,         emp_id, '2026-12-23'), (t_renova,        emp_id, '2026-05-27');
end $$;

-- ---- VEHÍCULOS ROSARIO ----
do $$
declare eid uuid;
begin
  select id into eid from empresas where slug = 'tecnophos-rosario';
  insert into vehiculos (patente, empresa_id) values
    ('AC327DB', eid), ('AE268VT', eid), ('AF540SP', eid), ('AD980YF', eid), ('AG048TW', eid);
end $$;

-- ---- TECNOPHOS NECOCHEA ----
do $$
declare
  eid uuid; emp_id uuid;
  t_carnet uuid; t_medicos uuid; t_sitio0 uuid; t_aplicador uuid;
begin
  select id into eid from empresas where slug = 'tecnophos-necochea';
  select id into t_carnet from tipos_certificado where nombre = 'Carnet de Conducir';
  select id into t_medicos from tipos_certificado where nombre = 'Exámenes Médicos';
  select id into t_sitio0 from tipos_certificado where nombre = 'Evaluación de Inducción / Ingreso Sitio 0';
  select id into t_aplicador from tipos_certificado where nombre = 'Carnet de Aplicador';

  insert into empleados (nombre, empresa_id) values ('Amaya Facundo', eid) returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_carnet, emp_id, '2027-04-12'), (t_medicos, emp_id, '2026-07-31'),
    (t_sitio0, emp_id, '2026-08-05'), (t_aplicador, emp_id, '2028-01-02');

  insert into empleados (nombre, empresa_id) values ('Blanco Ramiro', eid) returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_carnet, emp_id, '2028-10-23'), (t_medicos, emp_id, '2027-12-15'),
    (t_sitio0, emp_id, '2026-12-26');

  insert into empleados (nombre, empresa_id) values ('Torres Tomas', eid) returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_carnet, emp_id, '2027-12-26'), (t_medicos, emp_id, '2026-08-02'),
    (t_sitio0, emp_id, '2026-08-12'), (t_aplicador, emp_id, '2027-11-25');

  insert into empleados (nombre, empresa_id) values ('Rodriguez Juan Pablo', eid) returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_carnet, emp_id, '2030-02-13'), (t_medicos, emp_id, '2028-02-20'),
    (t_sitio0, emp_id, '2026-06-02');
end $$;

-- ---- VEHÍCULOS NECOCHEA ----
do $$
declare eid uuid;
begin
  select id into eid from empresas where slug = 'tecnophos-necochea';
  insert into vehiculos (patente, empresa_id) values ('AH029RH', eid), ('AE243XP', eid);
end $$;

-- ---- ADC ----
do $$
declare
  eid uuid; emp_id uuid;
  t_carnet uuid; t_medicos uuid; t_unipar uuid; t_aplicador uuid;
begin
  select id into eid from empresas where slug = 'adc';
  select id into t_carnet from tipos_certificado where nombre = 'Carnet de Conducir';
  select id into t_medicos from tipos_certificado where nombre = 'Exámenes Médicos';
  select id into t_unipar from tipos_certificado where nombre = 'Curso Unipar';
  select id into t_aplicador from tipos_certificado where nombre = 'Carnet de Aplicador';

  -- Fumigación
  insert into empleados (nombre, empresa_id, sector) values ('Albin Hugo Alberto', eid, 'Fumigación') returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values (t_medicos, emp_id, '2026-04-30');

  -- Limpieza
  insert into empleados (nombre, empresa_id, sector) values ('Aguayo Paola', eid, 'Limpieza') returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_medicos, emp_id, '2026-07-12'), (t_unipar, emp_id, '2026-11-20');

  insert into empleados (nombre, empresa_id, sector) values ('Alfaro Gabriela', eid, 'Limpieza') returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_medicos, emp_id, '2027-07-29'), (t_unipar, emp_id, '2026-08-21');

  insert into empleados (nombre, empresa_id, sector) values ('Antihuala', eid, 'Limpieza') returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_medicos, emp_id, '2027-02-24'), (t_unipar, emp_id, '2026-08-28');

  insert into empleados (nombre, empresa_id, sector) values ('Castro Noemi', eid, 'Limpieza') returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_medicos, emp_id, '2027-02-19'), (t_unipar, emp_id, '2026-08-28');

  insert into empleados (nombre, empresa_id, sector) values ('Herrera Fabio', eid, 'Limpieza') returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values (t_unipar, emp_id, '2026-08-07');

  insert into empleados (nombre, empresa_id, sector) values ('Huss Maria Ester', eid, 'Limpieza') returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_medicos, emp_id, '2027-08-17'), (t_unipar, emp_id, '2026-08-28');

  insert into empleados (nombre, empresa_id, sector) values ('Laura Quevedo', eid, 'Limpieza') returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_medicos, emp_id, '2027-08-02'), (t_unipar, emp_id, '2027-03-26');

  insert into empleados (nombre, empresa_id, sector) values ('Laxtalde Lourdes', eid, 'Limpieza') returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_medicos, emp_id, '2026-03-24'), (t_unipar, emp_id, '2027-04-09');

  insert into empleados (nombre, empresa_id, sector) values ('Meder Sonia', eid, 'Limpieza') returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_medicos, emp_id, '2027-01-16'), (t_unipar, emp_id, '2026-11-27');

  insert into empleados (nombre, empresa_id, sector) values ('Moyano Valeria', eid, 'Limpieza') returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_medicos, emp_id, '2026-12-31'), (t_unipar, emp_id, '2026-08-07');

  insert into empleados (nombre, empresa_id, sector) values ('Mugnolo Celeste', eid, 'Limpieza') returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_medicos, emp_id, '2027-02-06'), (t_unipar, emp_id, '2026-12-04');

  insert into empleados (nombre, empresa_id, sector) values ('Obreque Natalia', eid, 'Limpieza') returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_medicos, emp_id, '2026-10-09'), (t_unipar, emp_id, '2027-10-22');

  insert into empleados (nombre, empresa_id, sector) values ('Pando Noelia', eid, 'Limpieza') returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_medicos, emp_id, '2026-12-24'), (t_unipar, emp_id, '2026-07-24');

  insert into empleados (nombre, empresa_id, sector) values ('Pradena Castro Micaela', eid, 'Limpieza') returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_medicos, emp_id, '2027-06-04'), (t_unipar, emp_id, '2027-12-26');

  insert into empleados (nombre, empresa_id, sector) values ('Samaniego Elias', eid, 'Limpieza') returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_medicos, emp_id, '2027-04-05'), (t_unipar, emp_id, '2027-03-31');

  -- Palas
  insert into empleados (nombre, empresa_id, sector) values ('Cordoba Eliel', eid, 'Palas') returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values (t_medicos, emp_id, '2027-02-25');

  insert into empleados (nombre, empresa_id, sector) values ('Fernandez Luciano', eid, 'Palas') returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_medicos, emp_id, '2026-05-22'), (t_unipar, emp_id, '2026-06-12');

  insert into empleados (nombre, empresa_id, sector) values ('Garcia Alan', eid, 'Palas') returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_medicos, emp_id, '2027-02-20'), (t_unipar, emp_id, '2028-03-11');

  insert into empleados (nombre, empresa_id, sector) values ('Monzon Agustin', eid, 'Palas') returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_medicos, emp_id, '2026-12-29'), (t_unipar, emp_id, '2028-01-14');

  insert into empleados (nombre, empresa_id, sector) values ('Quevedo Ramon', eid, 'Palas') returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_medicos, emp_id, '2026-12-29'), (t_unipar, emp_id, '2027-07-16');

  insert into empleados (nombre, empresa_id, sector) values ('Segura Lucas', eid, 'Palas') returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_medicos, emp_id, '2026-06-18'), (t_unipar, emp_id, '2026-06-19');

  -- Sal
  insert into empleados (nombre, empresa_id, sector) values ('Alvarado Gonzalo', eid, 'Sal') returning id into emp_id;

  insert into empleados (nombre, empresa_id, sector) values ('Aravena Joel', eid, 'Sal') returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_carnet, emp_id, '2028-07-13'), (t_medicos, emp_id, '2027-03-23'), (t_unipar, emp_id, '2026-11-06');

  insert into empleados (nombre, empresa_id, sector) values ('Calzada Fabio Damian', eid, 'Sal') returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_carnet, emp_id, '2028-11-08'), (t_medicos, emp_id, '2027-05-12'), (t_unipar, emp_id, '2026-04-24');

  insert into empleados (nombre, empresa_id, sector) values ('Gallinger Esteban', eid, 'Sal') returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_carnet, emp_id, '2029-04-18'), (t_medicos, emp_id, '2026-06-17'), (t_unipar, emp_id, '2027-06-25');

  insert into empleados (nombre, empresa_id, sector) values ('Garaban Holzmann Axel', eid, 'Sal') returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_carnet, emp_id, '2027-09-20'), (t_medicos, emp_id, '2026-04-14'), (t_unipar, emp_id, '2026-06-26');

  insert into empleados (nombre, empresa_id, sector) values ('Guajardo Nestor', eid, 'Sal') returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_carnet, emp_id, '2029-04-24'), (t_medicos, emp_id, '2026-05-25'), (t_unipar, emp_id, '2028-03-11');

  insert into empleados (nombre, empresa_id, sector) values ('Martinez Gabriel', eid, 'Sal') returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_carnet, emp_id, '2027-10-28'), (t_medicos, emp_id, '2026-04-15'), (t_unipar, emp_id, '2027-05-14');

  insert into empleados (nombre, empresa_id, sector) values ('Neira Pablo', eid, 'Sal') returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_carnet, emp_id, '2027-09-27'), (t_medicos, emp_id, '2026-04-28'), (t_unipar, emp_id, '2026-12-04');

  insert into empleados (nombre, empresa_id, sector) values ('Perez Leandro', eid, 'Sal') returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_carnet, emp_id, '2026-11-04'), (t_medicos, emp_id, '2026-04-09'), (t_unipar, emp_id, '2027-03-31');

  insert into empleados (nombre, empresa_id, sector) values ('Rodriguez Fernando', eid, 'Sal') returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_carnet, emp_id, '2027-11-04'), (t_medicos, emp_id, '2026-04-20'), (t_unipar, emp_id, '2026-05-08');

  insert into empleados (nombre, empresa_id, sector) values ('Salmeri Juan Jose', eid, 'Sal') returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_carnet, emp_id, '2029-04-09'), (t_medicos, emp_id, '2026-05-12'), (t_unipar, emp_id, '2028-03-18');

  insert into empleados (nombre, empresa_id, sector) values ('Stieb', eid, 'Sal') returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_carnet, emp_id, '2027-09-06'), (t_medicos, emp_id, '2027-03-09'), (t_unipar, emp_id, '2026-11-20');

  insert into empleados (nombre, empresa_id, sector) values ('Vogel Hernan', eid, 'Sal') returning id into emp_id;
  insert into certificados (tipo_id, empleado_id, fecha_vencimiento) values
    (t_carnet, emp_id, '2027-11-13'), (t_medicos, emp_id, '2026-07-09'), (t_unipar, emp_id, '2026-03-25');
end $$;

-- ---- VEHÍCULOS ADC ----
do $$
declare eid uuid;
begin
  select id into eid from empresas where slug = 'adc';
  insert into vehiculos (patente, empresa_id) values ('AG493RP', eid), ('AH797GH', eid), ('AH928EQ', eid);
end $$;
