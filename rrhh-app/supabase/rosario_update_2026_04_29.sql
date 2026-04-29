-- ============================================================
-- Actualización datos Rosario desde Excel
-- Archivo fuente: Vencimientos Personal Tecnophos.xlsx
-- Hoja: TECNOPHOS ROSARIO
-- Generado: 2026-04-29
-- Alcance: solo empresa slug tecnophos-rosario
-- ============================================================

begin;

do $$
declare
  v_empresa_id uuid;
begin
  select id into v_empresa_id from empresas where slug = 'tecnophos-rosario';
  if v_empresa_id is null then
    raise exception 'No existe la empresa tecnophos-rosario en tabla empresas';
  end if;

  create temp table tmp_rosario_empleados(nombre text primary key) on commit drop;
  create temp table tmp_rosario_certificados_empleado(nombre text, tipo text, fecha date) on commit drop;
  create temp table tmp_rosario_certificados_empresa(tipo text, custom text, fecha date) on commit drop;
  create temp table tmp_rosario_vehiculos(patente text primary key, fecha_vtv date) on commit drop;

  insert into tmp_rosario_empleados(nombre) values
    ('ARANDA DANIEL ALFREDO'),
    ('BIANCOTTI RICARDO ROMAN'),
    ('CABELLO ALEXIS ADEMIR'),
    ('CACERES CRISTIAN MAXIMILIANO'),
    ('DADAMO ALEXIS ALEJANDRO'),
    ('DIAZ LUCAS JOEL'),
    ('FEDERICI MICHEL ALEXANDER'),
    ('GALLUCCI BRUNO EDUARDO'),
    ('GALLUCCI LUCAS MARTIN'),
    ('GONELLA OSCAR JESUS'),
    ('GUTIERREZ BOSSO FERNANDO LAUTARO'),
    ('HERRERA CRISTIAN ARIEL'),
    ('LEIVA IVAN MATIAS'),
    ('LIOI ELIAS JAVIER'),
    ('LOPEZ GUSTAVO ANDRES'),
    ('LOPEZ PEDRO ANGEL'),
    ('MARTINEZ GIAN FRANCO'),
    ('MERCAU JUAN ROLANDO'),
    ('MIÑO JESUS DANIEL'),
    ('MOLINA JOSE ORLANDO'),
    ('MONTENEGRO MATIAS EMILIANO'),
    ('NAVARRO DAVID JOEL'),
    ('NIZ ALAN EMIR'),
    ('OSCARES CLAUDIO EMILIO'),
    ('PAYER JUAN JOSE'),
    ('RECOFSKY DIEGO LAUTARO'),
    ('RINCON FACUNDO SEBASTIAN'),
    ('RODRIGUEZ TOMAS AGUSTIN'),
    ('SALVI BRUNO PEDRO'),
    ('SUAREZ SANTIAGO NICOLAS'),
    ('TASSI JUAN IGNACIO'),
    ('VERA JONATAN EMANUEL'),
    ('VERON HECTOR EMANUEL'),
    ('VILLALBA JUAN RAMON'),
    ('VOLPATO FERNANDO LUIS'),
    ('ZABALA JUAN LEONARDO');

  insert into tmp_rosario_certificados_empleado(nombre, tipo, fecha) values
    ('ARANDA DANIEL ALFREDO', 'Exámenes Médicos', date '2026-04-08'),
    ('ARANDA DANIEL ALFREDO', 'Inducción Bunge PGSM', date '2026-07-01'),
    ('ARANDA DANIEL ALFREDO', 'Inducción Gral Bunge', date '2026-07-01'),
    ('ARANDA DANIEL ALFREDO', 'Inducción Renova', date '2026-12-03'),
    ('ARANDA DANIEL ALFREDO', 'Inducción Terminal 6', date '2026-06-03'),
    ('BIANCOTTI RICARDO ROMAN', 'Exámenes Médicos', date '2026-06-06'),
    ('BIANCOTTI RICARDO ROMAN', 'Inducción Bunge PGSM', date '2026-08-28'),
    ('BIANCOTTI RICARDO ROMAN', 'Inducción Bunge Ramallo', date '2026-04-28'),
    ('BIANCOTTI RICARDO ROMAN', 'Inducción Gral Bunge', date '2026-08-28'),
    ('BIANCOTTI RICARDO ROMAN', 'Inducción Cofco', date '2026-08-06'),
    ('BIANCOTTI RICARDO ROMAN', 'Inducción Renova', date '2026-11-18'),
    ('BIANCOTTI RICARDO ROMAN', 'Inducción Terminal 6', date '2026-07-22'),
    ('CABELLO ALEXIS ADEMIR', 'Exámenes Médicos', date '2026-05-05'),
    ('CABELLO ALEXIS ADEMIR', 'Inducción Bunge PGSM', date '2026-05-30'),
    ('CABELLO ALEXIS ADEMIR', 'Inducción Bunge Ramallo', date '2026-04-28'),
    ('CABELLO ALEXIS ADEMIR', 'Inducción Gral Bunge', date '2026-05-30'),
    ('CABELLO ALEXIS ADEMIR', 'Inducción Cofco', date '2026-05-26'),
    ('CABELLO ALEXIS ADEMIR', 'Inducción Renova', date '2026-05-07'),
    ('CABELLO ALEXIS ADEMIR', 'Inducción Terminal 6', date '2026-06-25'),
    ('CACERES CRISTIAN MAXIMILIANO', 'Carnet de Personal Portuario', date '2027-06-03'),
    ('CACERES CRISTIAN MAXIMILIANO', 'Exámenes Médicos', date '2026-08-04'),
    ('CACERES CRISTIAN MAXIMILIANO', 'Inducción Bunge PGSM', date '2027-03-17'),
    ('CACERES CRISTIAN MAXIMILIANO', 'Inducción Gral Bunge', date '2027-03-17'),
    ('CACERES CRISTIAN MAXIMILIANO', 'Inducción Cofco', date '2027-01-19'),
    ('CACERES CRISTIAN MAXIMILIANO', 'Inducción Renova', date '2026-12-03'),
    ('CACERES CRISTIAN MAXIMILIANO', 'Inducción Terminal 6', date '2026-09-29'),
    ('DADAMO ALEXIS ALEJANDRO', 'Exámenes Médicos', date '2026-06-17'),
    ('DADAMO ALEXIS ALEJANDRO', 'Inducción Bunge PGSM', date '2026-03-11'),
    ('DADAMO ALEXIS ALEJANDRO', 'Inducción Gral Bunge', date '2026-03-11'),
    ('DADAMO ALEXIS ALEJANDRO', 'Inducción Cofco', date '2026-08-06'),
    ('DADAMO ALEXIS ALEJANDRO', 'Inducción Renova', date '2026-10-30'),
    ('DADAMO ALEXIS ALEJANDRO', 'Inducción Terminal 6', date '2026-07-22'),
    ('DIAZ LUCAS JOEL', 'Carnet de Aplicador', date '2027-08-10'),
    ('DIAZ LUCAS JOEL', 'Inducción Bunge PGSM', date '2026-04-01'),
    ('DIAZ LUCAS JOEL', 'Inducción Gral Bunge', date '2026-04-01'),
    ('DIAZ LUCAS JOEL', 'Inducción Cofco', date '2026-10-29'),
    ('DIAZ LUCAS JOEL', 'Inducción Renova', date '2026-01-02'),
    ('DIAZ LUCAS JOEL', 'Inducción Terminal 6', date '2026-02-10'),
    ('FEDERICI MICHEL ALEXANDER', 'Carnet de Aplicador', date '2026-09-30'),
    ('FEDERICI MICHEL ALEXANDER', 'Exámenes Médicos', date '2026-11-17'),
    ('FEDERICI MICHEL ALEXANDER', 'Inducción Bunge PGSM', date '2027-03-03'),
    ('FEDERICI MICHEL ALEXANDER', 'Inducción Gral Bunge', date '2027-03-03'),
    ('FEDERICI MICHEL ALEXANDER', 'Inducción Cofco', date '2027-01-19'),
    ('FEDERICI MICHEL ALEXANDER', 'Inducción Renova', date '2027-02-12'),
    ('FEDERICI MICHEL ALEXANDER', 'Inducción Terminal 6', date '2026-02-10'),
    ('GALLUCCI BRUNO EDUARDO', 'Carnet de Aplicador', date '2026-09-30'),
    ('GALLUCCI BRUNO EDUARDO', 'Exámenes Médicos', date '2026-09-16'),
    ('GALLUCCI BRUNO EDUARDO', 'Inducción Bunge PGSM', date '2026-09-02'),
    ('GALLUCCI BRUNO EDUARDO', 'Inducción Gral Bunge', date '2026-04-28'),
    ('GALLUCCI BRUNO EDUARDO', 'Inducción Cofco', date '2026-10-22'),
    ('GALLUCCI BRUNO EDUARDO', 'Inducción Renova', date '2026-12-03'),
    ('GALLUCCI BRUNO EDUARDO', 'Inducción Terminal 6', date '2027-02-03'),
    ('GALLUCCI LUCAS MARTIN', 'Exámenes Médicos', date '2026-11-27'),
    ('GALLUCCI LUCAS MARTIN', 'Inducción Bunge PGSM', date '2026-12-23'),
    ('GALLUCCI LUCAS MARTIN', 'Inducción Gral Bunge', date '2026-12-23'),
    ('GALLUCCI LUCAS MARTIN', 'Inducción Cofco', date '2026-12-11'),
    ('GALLUCCI LUCAS MARTIN', 'Inducción Renova', date '2027-01-07'),
    ('GALLUCCI LUCAS MARTIN', 'Inducción Terminal 6', date '2026-03-31'),
    ('GONELLA OSCAR JESUS', 'Exámenes Médicos', date '2026-04-17'),
    ('GONELLA OSCAR JESUS', 'Inducción Bunge PGSM', date '2026-05-30'),
    ('GONELLA OSCAR JESUS', 'Inducción Gral Bunge', date '2026-05-30'),
    ('GONELLA OSCAR JESUS', 'Inducción Cofco', date '2026-04-30'),
    ('GONELLA OSCAR JESUS', 'Inducción Renova', date '2026-05-07'),
    ('GONELLA OSCAR JESUS', 'Inducción Terminal 6', date '2026-05-13'),
    ('GUTIERREZ BOSSO FERNANDO LAUTARO', 'Carnet de Aplicador', date '2027-08-10'),
    ('GUTIERREZ BOSSO FERNANDO LAUTARO', 'Exámenes Médicos', date '2026-12-10'),
    ('GUTIERREZ BOSSO FERNANDO LAUTARO', 'Inducción Bunge PGSM', date '2026-10-14'),
    ('GUTIERREZ BOSSO FERNANDO LAUTARO', 'Inducción Gral Bunge', date '2026-04-28'),
    ('GUTIERREZ BOSSO FERNANDO LAUTARO', 'Inducción Cofco', date '2027-01-19'),
    ('GUTIERREZ BOSSO FERNANDO LAUTARO', 'Inducción Renova', date '2026-11-26'),
    ('GUTIERREZ BOSSO FERNANDO LAUTARO', 'Inducción Terminal 6', date '2026-04-15'),
    ('HERRERA CRISTIAN ARIEL', 'Carnet de Aplicador', date '2027-08-10'),
    ('HERRERA CRISTIAN ARIEL', 'Carnet de Personal Portuario', date '2027-01-17'),
    ('HERRERA CRISTIAN ARIEL', 'Exámenes Médicos', date '2027-03-02'),
    ('HERRERA CRISTIAN ARIEL', 'Inducción Bunge PGSM', date '2026-10-07'),
    ('HERRERA CRISTIAN ARIEL', 'Inducción Bunge Ramallo', date '2026-04-28'),
    ('HERRERA CRISTIAN ARIEL', 'Inducción Gral Bunge', date '2026-10-07'),
    ('HERRERA CRISTIAN ARIEL', 'Inducción Cofco', date '2027-03-04'),
    ('HERRERA CRISTIAN ARIEL', 'Inducción Renova', date '2026-11-26'),
    ('HERRERA CRISTIAN ARIEL', 'Inducción Terminal 6', date '2026-03-25'),
    ('HERRERA CRISTIAN ARIEL', 'Habilitación Transporte Mercancías Peligrosas', date '2026-03-14'),
    ('LEIVA IVAN MATIAS', 'Exámenes Médicos', date '2026-12-09'),
    ('LEIVA IVAN MATIAS', 'Inducción Bunge PGSM', date '2026-09-16'),
    ('LEIVA IVAN MATIAS', 'Inducción Gral Bunge', date '2026-09-16'),
    ('LEIVA IVAN MATIAS', 'Inducción Cofco', date '2027-03-04'),
    ('LEIVA IVAN MATIAS', 'Inducción Renova', date '2026-12-17'),
    ('LEIVA IVAN MATIAS', 'Inducción Terminal 6', date '2026-10-28'),
    ('LIOI ELIAS JAVIER', 'Exámenes Médicos', date '2027-03-03'),
    ('LIOI ELIAS JAVIER', 'Inducción Bunge PGSM', date '2026-02-11'),
    ('LIOI ELIAS JAVIER', 'Inducción Gral Bunge', date '2026-02-11'),
    ('LIOI ELIAS JAVIER', 'Inducción Cofco', date '2026-04-07'),
    ('LIOI ELIAS JAVIER', 'Inducción Renova', date '2026-04-03'),
    ('LIOI ELIAS JAVIER', 'Inducción Terminal 6', date '2026-12-27'),
    ('LOPEZ GUSTAVO ANDRES', 'Exámenes Médicos', date '2026-12-11'),
    ('LOPEZ GUSTAVO ANDRES', 'Inducción Bunge PGSM', date '2027-03-10'),
    ('LOPEZ GUSTAVO ANDRES', 'Inducción Gral Bunge', date '2027-03-10'),
    ('LOPEZ GUSTAVO ANDRES', 'Inducción Cofco', date '2027-03-03'),
    ('LOPEZ GUSTAVO ANDRES', 'Inducción Renova', date '2026-11-12'),
    ('LOPEZ GUSTAVO ANDRES', 'Inducción Terminal 6', date '2026-07-22'),
    ('LOPEZ PEDRO ANGEL', 'Exámenes Médicos', date '2026-04-11'),
    ('LOPEZ PEDRO ANGEL', 'Inducción Bunge PGSM', date '2027-03-17'),
    ('LOPEZ PEDRO ANGEL', 'Inducción Gral Bunge', date '2027-03-17'),
    ('LOPEZ PEDRO ANGEL', 'Inducción Cofco', date '2026-08-18'),
    ('LOPEZ PEDRO ANGEL', 'Inducción Renova', date '2026-05-07'),
    ('LOPEZ PEDRO ANGEL', 'Inducción Terminal 6', date '2026-05-20'),
    ('MARTINEZ GIAN FRANCO', 'Carnet de Aplicador', date '2027-08-10'),
    ('MARTINEZ GIAN FRANCO', 'Carnet de Personal Portuario', date '2027-03-07'),
    ('MARTINEZ GIAN FRANCO', 'Exámenes Médicos', date '2026-10-13'),
    ('MARTINEZ GIAN FRANCO', 'Inducción Bunge PGSM', date '2026-11-04'),
    ('MARTINEZ GIAN FRANCO', 'Inducción Gral Bunge', date '2026-11-04'),
    ('MARTINEZ GIAN FRANCO', 'Inducción Cofco', date '2026-08-13'),
    ('MARTINEZ GIAN FRANCO', 'Inducción Renova', date '2026-04-30'),
    ('MARTINEZ GIAN FRANCO', 'Inducción Terminal 6', date '2026-06-26'),
    ('MERCAU JUAN ROLANDO', 'Carnet de Aplicador', date '2027-08-10'),
    ('MERCAU JUAN ROLANDO', 'Carnet de Personal Portuario', date '2027-05-08'),
    ('MERCAU JUAN ROLANDO', 'Exámenes Médicos', date '2026-04-21'),
    ('MERCAU JUAN ROLANDO', 'Inducción Bunge PGSM', date '2026-08-26'),
    ('MERCAU JUAN ROLANDO', 'Inducción Bunge Ramallo', date '2026-08-26'),
    ('MERCAU JUAN ROLANDO', 'Inducción Gral Bunge', date '2026-08-26'),
    ('MERCAU JUAN ROLANDO', 'Inducción Cofco', date '2027-01-29'),
    ('MERCAU JUAN ROLANDO', 'Inducción Renova', date '2026-11-26'),
    ('MERCAU JUAN ROLANDO', 'Inducción Terminal 6', date '2026-11-11'),
    ('MERCAU JUAN ROLANDO', 'Habilitación Transporte Mercancías Peligrosas', date '2026-12-14'),
    ('MIÑO JESUS DANIEL', 'Carnet de Aplicador', date '2027-08-10'),
    ('MIÑO JESUS DANIEL', 'Exámenes Médicos', date '2026-04-28'),
    ('MIÑO JESUS DANIEL', 'Inducción Bunge PGSM', date '2026-11-04'),
    ('MIÑO JESUS DANIEL', 'Inducción Gral Bunge', date '2026-11-04'),
    ('MIÑO JESUS DANIEL', 'Inducción Cofco', date '2026-10-22'),
    ('MIÑO JESUS DANIEL', 'Inducción Renova', date '2026-12-17'),
    ('MIÑO JESUS DANIEL', 'Inducción Terminal 6', date '2026-05-20'),
    ('MOLINA JOSE ORLANDO', 'Carnet de Personal Portuario', date '2026-09-20'),
    ('MOLINA JOSE ORLANDO', 'Exámenes Médicos', date '2027-03-03'),
    ('MOLINA JOSE ORLANDO', 'Inducción Bunge PGSM', date '2026-12-02'),
    ('MOLINA JOSE ORLANDO', 'Inducción Gral Bunge', date '2026-12-02'),
    ('MOLINA JOSE ORLANDO', 'Inducción Cofco', date '2026-11-12'),
    ('MOLINA JOSE ORLANDO', 'Inducción Renova', date '2026-11-18'),
    ('MOLINA JOSE ORLANDO', 'Inducción Terminal 6', date '2026-10-14'),
    ('MONTENEGRO MATIAS EMILIANO', 'Carnet de Aplicador', date '2027-08-10'),
    ('MONTENEGRO MATIAS EMILIANO', 'Exámenes Médicos', date '2026-12-09'),
    ('MONTENEGRO MATIAS EMILIANO', 'Inducción Bunge PGSM', date '2027-03-03'),
    ('MONTENEGRO MATIAS EMILIANO', 'Inducción Gral Bunge', date '2027-03-03'),
    ('MONTENEGRO MATIAS EMILIANO', 'Inducción Cofco', date '2026-03-26'),
    ('MONTENEGRO MATIAS EMILIANO', 'Inducción Renova', date '2026-11-11'),
    ('MONTENEGRO MATIAS EMILIANO', 'Inducción Terminal 6', date '2027-03-11'),
    ('NAVARRO DAVID JOEL', 'Exámenes Médicos', date '2027-01-22'),
    ('NAVARRO DAVID JOEL', 'Inducción Bunge PGSM', date '2027-01-27'),
    ('NAVARRO DAVID JOEL', 'Inducción Gral Bunge', date '2027-01-27'),
    ('NAVARRO DAVID JOEL', 'Inducción Cofco', date '2027-02-02'),
    ('NAVARRO DAVID JOEL', 'Inducción Renova', date '2027-01-28'),
    ('NIZ ALAN EMIR', 'Exámenes Médicos', date '2026-10-06'),
    ('NIZ ALAN EMIR', 'Inducción Bunge Ramallo', date '2026-11-11'),
    ('NIZ ALAN EMIR', 'Inducción Gral Bunge', date '2026-11-11'),
    ('OSCARES CLAUDIO EMILIO', 'Exámenes Médicos', date '2027-03-03'),
    ('OSCARES CLAUDIO EMILIO', 'Inducción Gral Bunge', date '2026-11-11'),
    ('OSCARES CLAUDIO EMILIO', 'Inducción Cofco', date '2027-02-12'),
    ('PAYER JUAN JOSE', 'Exámenes Médicos', date '2027-01-02'),
    ('PAYER JUAN JOSE', 'Inducción Bunge PGSM', date '2026-12-23'),
    ('PAYER JUAN JOSE', 'Inducción Gral Bunge', date '2026-12-23'),
    ('PAYER JUAN JOSE', 'Inducción Cofco', date '2027-03-04'),
    ('PAYER JUAN JOSE', 'Inducción Renova', date '2026-12-03'),
    ('PAYER JUAN JOSE', 'Inducción Terminal 6', date '2026-12-27'),
    ('RECOFSKY DIEGO LAUTARO', 'Exámenes Médicos', date '2026-11-27'),
    ('RECOFSKY DIEGO LAUTARO', 'Inducción Bunge PGSM', date '2026-12-23'),
    ('RECOFSKY DIEGO LAUTARO', 'Inducción Gral Bunge', date '2026-12-23'),
    ('RECOFSKY DIEGO LAUTARO', 'Inducción Cofco', date '2026-12-11'),
    ('RECOFSKY DIEGO LAUTARO', 'Inducción Renova', date '2027-01-14'),
    ('RECOFSKY DIEGO LAUTARO', 'Inducción Terminal 6', date '2027-02-03'),
    ('RINCON FACUNDO SEBASTIAN', 'Carnet de Aplicador', date '2027-08-10'),
    ('RINCON FACUNDO SEBASTIAN', 'Exámenes Médicos', date '2026-06-18'),
    ('RINCON FACUNDO SEBASTIAN', 'Inducción Bunge PGSM', date '2026-09-02'),
    ('RINCON FACUNDO SEBASTIAN', 'Inducción Gral Bunge', date '2026-04-28'),
    ('RINCON FACUNDO SEBASTIAN', 'Inducción Cofco', date '2026-10-29'),
    ('RINCON FACUNDO SEBASTIAN', 'Inducción Renova', date '2026-12-03'),
    ('RINCON FACUNDO SEBASTIAN', 'Inducción Terminal 6', date '2026-07-29'),
    ('RODRIGUEZ TOMAS AGUSTIN', 'Exámenes Médicos', date '2027-03-06'),
    ('RODRIGUEZ TOMAS AGUSTIN', 'Inducción Cofco', date '2027-03-04'),
    ('RODRIGUEZ TOMAS AGUSTIN', 'Inducción Renova', date '2027-03-12'),
    ('SALVI BRUNO PEDRO', 'Carnet de Aplicador', date '2026-09-30'),
    ('SALVI BRUNO PEDRO', 'Exámenes Médicos', date '2027-02-06'),
    ('SALVI BRUNO PEDRO', 'Inducción Bunge PGSM', date '2027-01-06'),
    ('SALVI BRUNO PEDRO', 'Inducción Gral Bunge', date '2027-01-06'),
    ('SALVI BRUNO PEDRO', 'Inducción Cofco', date '2026-04-16'),
    ('SALVI BRUNO PEDRO', 'Inducción Renova', date '2026-04-23'),
    ('SALVI BRUNO PEDRO', 'Inducción Terminal 6', date '2026-08-18'),
    ('SUAREZ SANTIAGO NICOLAS', 'Exámenes Médicos', date '2026-10-07'),
    ('SUAREZ SANTIAGO NICOLAS', 'Inducción Cofco', date '2026-10-30'),
    ('TASSI JUAN IGNACIO', 'Exámenes Médicos', date '2027-02-18'),
    ('TASSI JUAN IGNACIO', 'Inducción Bunge Ramallo', date '2027-01-27'),
    ('TASSI JUAN IGNACIO', 'Inducción Gral Bunge', date '2027-01-27'),
    ('VERA JONATAN EMANUEL', 'Carnet de Aplicador', date '2027-08-10'),
    ('VERA JONATAN EMANUEL', 'Carnet de Personal Portuario', date '2027-02-08'),
    ('VERA JONATAN EMANUEL', 'Exámenes Médicos', date '2026-04-10'),
    ('VERA JONATAN EMANUEL', 'Inducción Bunge PGSM', date '2027-03-17'),
    ('VERA JONATAN EMANUEL', 'Inducción Gral Bunge', date '2027-03-17'),
    ('VERA JONATAN EMANUEL', 'Inducción Cofco', date '2027-02-04'),
    ('VERA JONATAN EMANUEL', 'Inducción Renova', date '2026-12-03'),
    ('VERA JONATAN EMANUEL', 'Inducción Terminal 6', date '2026-05-27'),
    ('VERON HECTOR EMANUEL', 'Carnet de Aplicador', date '2027-08-10'),
    ('VERON HECTOR EMANUEL', 'Exámenes Médicos', date '2026-06-10'),
    ('VERON HECTOR EMANUEL', 'Inducción Bunge PGSM', date '2027-02-03'),
    ('VERON HECTOR EMANUEL', 'Inducción Gral Bunge', date '2027-02-03'),
    ('VERON HECTOR EMANUEL', 'Inducción Cofco', date '2026-08-06'),
    ('VERON HECTOR EMANUEL', 'Inducción Renova', date '2026-11-26'),
    ('VERON HECTOR EMANUEL', 'Inducción Terminal 6', date '2026-08-06'),
    ('VILLALBA JUAN RAMON', 'Carnet de Aplicador', date '2027-08-10'),
    ('VILLALBA JUAN RAMON', 'Exámenes Médicos', date '2027-03-04'),
    ('VILLALBA JUAN RAMON', 'Inducción Bunge PGSM', date '2027-03-17'),
    ('VILLALBA JUAN RAMON', 'Inducción Gral Bunge', date '2027-03-17'),
    ('VILLALBA JUAN RAMON', 'Inducción Cofco', date '2026-03-26'),
    ('VILLALBA JUAN RAMON', 'Inducción Renova', date '2026-04-03'),
    ('VILLALBA JUAN RAMON', 'Inducción Terminal 6', date '2026-05-20'),
    ('VOLPATO FERNANDO LUIS', 'Exámenes Médicos', date '2027-02-19'),
    ('VOLPATO FERNANDO LUIS', 'Inducción Bunge PGSM', date '2026-04-15'),
    ('VOLPATO FERNANDO LUIS', 'Inducción Bunge Ramallo', date '2027-01-20'),
    ('VOLPATO FERNANDO LUIS', 'Inducción Gral Bunge', date '2027-01-20'),
    ('ZABALA JUAN LEONARDO', 'Carnet de Aplicador', date '2027-08-10'),
    ('ZABALA JUAN LEONARDO', 'Exámenes Médicos', date '2027-02-06'),
    ('ZABALA JUAN LEONARDO', 'Inducción Bunge PGSM', date '2026-11-11'),
    ('ZABALA JUAN LEONARDO', 'Inducción Gral Bunge', date '2026-11-11'),
    ('ZABALA JUAN LEONARDO', 'Inducción Cofco', date '2026-03-26'),
    ('ZABALA JUAN LEONARDO', 'Inducción Renova', date '2026-12-23'),
    ('ZABALA JUAN LEONARDO', 'Inducción Terminal 6', date '2026-05-27');

  insert into tmp_rosario_certificados_empresa(tipo, custom, fecha) values
    ('Habilitación Municipal', null, date '2027-02-11'),
    ('Registro de Inscripción Santa Fe', null, date '2026-09-30'),
    ('Contrato Social Bunge PGSM', null, date '2028-05-31'),
    ('Contrato Social Bunge Ramallo', null, date '2028-05-31'),
    ('Carta Indemnidad Cofco', null, date '2027-02-04'),
    ('Contrato Renova', 'Contrato Renova N° 122273', date '2026-12-08'),
    ('Otro', 'Contrato Renova insumos-fumigación N° 101022', date '2026-12-31'),
    ('Otro', 'Contrato Renovamano de obra-fumigación N° 101021', date '2026-04-13');

  insert into tmp_rosario_vehiculos(patente, fecha_vtv) values
    ('AC327DB', date '2026-04-23'),
    ('AE268VT', date '2026-08-31'),
    ('AF540SP', date '2026-10-03'),
    ('AD980YF', date '2026-09-11'),
    ('AG048TW', date '2026-10-08');

  insert into empleados (nombre, empresa_id, activo)
  select t.nombre, v_empresa_id, true
  from tmp_rosario_empleados t
  where not exists (
    select 1 from empleados e
    where e.empresa_id = v_empresa_id and lower(trim(e.nombre)) = lower(trim(t.nombre))
  );

  update empleados e
  set activo = true, updated_at = now()
  from tmp_rosario_empleados t
  where e.empresa_id = v_empresa_id and lower(trim(e.nombre)) = lower(trim(t.nombre));

  insert into vehiculos (patente, empresa_id, activo)
  select t.patente, v_empresa_id, true
  from tmp_rosario_vehiculos t
  where not exists (
    select 1 from vehiculos v
    where v.empresa_id = v_empresa_id and upper(trim(v.patente)) = upper(trim(t.patente))
  );

  update vehiculos v
  set activo = true
  from tmp_rosario_vehiculos t
  where v.empresa_id = v_empresa_id and upper(trim(v.patente)) = upper(trim(t.patente));

  insert into certificados (empleado_id, tipo_id, fecha_vencimiento, alerta_dias)
  select e.id, tc.id, t.fecha, 30
  from tmp_rosario_certificados_empleado t
  join empleados e on e.empresa_id = v_empresa_id and lower(trim(e.nombre)) = lower(trim(t.nombre))
  join tipos_certificado tc on tc.nombre = t.tipo
  where not exists (
    select 1 from certificados c
    where c.empleado_id = e.id and c.tipo_id = tc.id and c.tipo_nombre_custom is null
  );

  update certificados c
  set fecha_vencimiento = t.fecha, updated_at = now()
  from tmp_rosario_certificados_empleado t
  join empleados e on e.empresa_id = v_empresa_id and lower(trim(e.nombre)) = lower(trim(t.nombre))
  join tipos_certificado tc on tc.nombre = t.tipo
  where c.empleado_id = e.id and c.tipo_id = tc.id and c.tipo_nombre_custom is null;

  insert into certificados (empresa_id, tipo_id, tipo_nombre_custom, fecha_vencimiento, alerta_dias)
  select v_empresa_id, tc.id, t.custom, t.fecha, 30
  from tmp_rosario_certificados_empresa t
  join tipos_certificado tc on tc.nombre = t.tipo
  where not exists (
    select 1 from certificados c
    where c.empresa_id = v_empresa_id
      and c.tipo_id = tc.id
      and coalesce(c.tipo_nombre_custom, '') = coalesce(t.custom, '')
  );

  update certificados c
  set fecha_vencimiento = t.fecha, updated_at = now(), tipo_nombre_custom = t.custom
  from tmp_rosario_certificados_empresa t
  join tipos_certificado tc on tc.nombre = t.tipo
  where c.empresa_id = v_empresa_id
    and c.tipo_id = tc.id
    and coalesce(c.tipo_nombre_custom, '') = coalesce(t.custom, '');

  insert into certificados (vehiculo_id, tipo_id, fecha_vencimiento, alerta_dias)
  select v.id, tc.id, t.fecha_vtv, 30
  from tmp_rosario_vehiculos t
  join vehiculos v on v.empresa_id = v_empresa_id and upper(trim(v.patente)) = upper(trim(t.patente))
  join tipos_certificado tc on tc.nombre = 'VTV'
  where not exists (
    select 1 from certificados c
    where c.vehiculo_id = v.id and c.tipo_id = tc.id and c.tipo_nombre_custom is null
  );

  update certificados c
  set fecha_vencimiento = t.fecha_vtv, updated_at = now()
  from tmp_rosario_vehiculos t
  join vehiculos v on v.empresa_id = v_empresa_id and upper(trim(v.patente)) = upper(trim(t.patente))
  join tipos_certificado tc on tc.nombre = 'VTV'
  where c.vehiculo_id = v.id and c.tipo_id = tc.id and c.tipo_nombre_custom is null;

  -- Dato no cargado por inconsistencia del Excel:
  -- ARANDA DANIEL ALFREDO / Inducción Cofco = '23/07/206'. Validar si corresponde 2026-07-23.
end $$;

commit;
