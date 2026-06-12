-- =============================================================================
-- SUPPLY CHAIN SAMPLE DATA — Snowflake
-- Schema: SUPPLY_CHAIN
-- Entities: Suppliers, Products, Warehouses, Carriers, Purchase Orders,
--           Inventory, Shipments, Goods Receipts, Demand Forecast,
--           Quality Inspections, Returns
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- SETUP
-- ─────────────────────────────────────────────────────────────────────────────
CREATE DATABASE IF NOT EXISTS DATAGUARD_DB;
USE DATABASE DATAGUARD_DB;

CREATE SCHEMA IF NOT EXISTS SUPPLY_CHAIN;
USE SCHEMA SUPPLY_CHAIN;


-- =============================================================================
-- DIMENSION TABLES
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. DIM_SUPPLIERS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE TABLE dim_suppliers (
    supplier_id         VARCHAR(20)   NOT NULL PRIMARY KEY,
    supplier_name       VARCHAR(200)  NOT NULL,
    supplier_type       VARCHAR(50),           -- manufacturer, distributor, 3pl, raw_material
    country             VARCHAR(100),
    region              VARCHAR(100),
    city                VARCHAR(100),
    address             VARCHAR(300),
    contact_name        VARCHAR(100),
    contact_email       VARCHAR(150),
    contact_phone       VARCHAR(30),
    payment_terms       VARCHAR(50),           -- NET30, NET60, NET90, COD
    lead_time_days      INT,
    reliability_score   DECIMAL(5,2),          -- 0–100
    on_time_rate        DECIMAL(5,2),          -- % on-time deliveries
    defect_rate         DECIMAL(5,2),          -- % defective goods
    tier                VARCHAR(10),           -- tier1, tier2, tier3
    status              VARCHAR(20),           -- active, inactive, on_hold, blacklisted
    contract_start_date DATE,
    contract_end_date   DATE,
    annual_spend_usd    DECIMAL(15,2),
    currency            VARCHAR(10),
    created_at          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    updated_at          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

INSERT INTO dim_suppliers VALUES
('SUP-001','GlobalTech Manufacturing','manufacturer','China','Asia-Pacific','Shenzhen','1800 Longhua Ave, Shenzhen 518131','Wei Zhang','wei.zhang@globaltech-mfg.cn','+86-755-8899-1234','NET60',45,91.5,92.3,1.2,'tier1','active','2022-01-01','2026-12-31',4200000.00,'USD'),
('SUP-002','Nordic Precision Parts','manufacturer','Germany','Europe','Stuttgart','Industriestrasse 44, 70565 Stuttgart','Klaus Müller','k.mueller@nordicprecision.de','+49-711-4422-9900','NET30',21,96.8,97.1,0.4,'tier1','active','2021-06-01','2026-05-31',2800000.00,'EUR'),
('SUP-003','AmeriSource Distributors','distributor','USA','North America','Chicago','2400 W Lake St, Chicago IL 60612','Sarah Johnson','s.johnson@amerisource.com','+1-312-555-0192','NET45',7,88.2,89.5,2.1,'tier1','active','2023-03-01','2025-02-28',1500000.00,'USD'),
('SUP-004','Apex Raw Materials','raw_material','Brazil','South America','São Paulo','Av. Paulista 1000, São Paulo 01310-100','Carlos Mendes','c.mendes@apexraw.com.br','+55-11-3344-5566','NET30',14,82.0,83.4,3.5,'tier2','active','2023-01-01','2025-12-31',850000.00,'BRL'),
('SUP-005','FastShip 3PL','3pl','USA','North America','Dallas','8900 Logistics Blvd, Dallas TX 75247','Mike Torres','m.torres@fastship3pl.com','+1-214-555-0381','COD',2,94.1,96.0,0.3,'tier1','active','2022-07-01','2027-06-30',620000.00,'USD'),
('SUP-006','TechComponents Asia','manufacturer','Taiwan','Asia-Pacific','Taipei','3F, 99 Minsheng E Rd, Taipei 10491','Amy Chen','a.chen@techcomp.tw','+886-2-2712-3456','NET45',30,90.3,91.0,1.8,'tier1','active','2022-09-01','2026-08-31',3100000.00,'USD'),
('SUP-007','EcoPackaging Ltd','manufacturer','Netherlands','Europe','Amsterdam','Keizersgracht 174, 1016 DW Amsterdam','Jan van der Berg','j.vanderberg@ecopack.nl','+31-20-555-8876','NET30',10,93.7,94.2,0.9,'tier2','active','2023-06-01','2026-05-31',410000.00,'EUR'),
('SUP-008','Meridian Electronics','distributor','USA','North America','San Jose','1200 Technology Dr, San Jose CA 95110','Linda Park','l.park@meridianelec.com','+1-408-555-0744','NET45',5,87.5,88.1,2.8,'tier2','active','2024-01-01','2025-12-31',290000.00,'USD'),
('SUP-009','Sigma Chemicals','raw_material','India','Asia-Pacific','Mumbai','Plot 12, MIDC Andheri East, Mumbai 400093','Raj Patel','r.patel@sigmachemicals.in','+91-22-2836-4455','NET60',20,79.4,80.0,4.1,'tier2','on_hold','2022-04-01','2025-03-31',175000.00,'INR'),
('SUP-010','VentureLogistics','3pl','Mexico','North America','Monterrey','Blvd. Luis Donaldo Colosio 1500, Monterrey 64860','Diego Ramirez','d.ramirez@ventlog.mx','+52-81-8332-0099','NET30',3,85.9,87.2,1.4,'tier2','active','2023-11-01','2026-10-31',330000.00,'MXN'),
('SUP-011','Pacific Metals Co','raw_material','Australia','Asia-Pacific','Melbourne','77 Port Rd, Laverton VIC 3028','Emma Wilson','e.wilson@pacificmetals.com.au','+61-3-9315-8800','NET45',18,88.9,90.1,2.3,'tier2','active','2022-12-01','2025-11-30',520000.00,'AUD'),
('SUP-012','CheapParts Express','distributor','China','Asia-Pacific','Guangzhou','Building 3, Pazhou Complex, Guangzhou 510330','Tony Liu','tony.liu@cheapparts.cn','+86-20-8888-3344','COD',60,61.2,62.0,8.9,'tier3','blacklisted','2023-01-01','2023-12-31',45000.00,'USD');


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. DIM_PRODUCTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE TABLE dim_products (
    product_id          VARCHAR(20)   NOT NULL PRIMARY KEY,
    sku                 VARCHAR(50)   NOT NULL UNIQUE,
    product_name        VARCHAR(200)  NOT NULL,
    description         VARCHAR(500),
    category            VARCHAR(100),
    sub_category        VARCHAR(100),
    brand               VARCHAR(100),
    unit_of_measure     VARCHAR(20),           -- each, kg, liter, box, pallet
    unit_cost_usd       DECIMAL(12,4),
    unit_price_usd      DECIMAL(12,4),
    weight_kg           DECIMAL(10,4),
    length_cm           DECIMAL(10,2),
    width_cm            DECIMAL(10,2),
    height_cm           DECIMAL(10,2),
    volume_cm3          DECIMAL(15,4),
    hazardous           BOOLEAN       DEFAULT FALSE,
    perishable          BOOLEAN       DEFAULT FALSE,
    shelf_life_days     INT,
    reorder_point       INT,
    reorder_quantity    INT,
    safety_stock        INT,
    preferred_supplier  VARCHAR(20),
    hs_code             VARCHAR(20),           -- Harmonized System trade code
    country_of_origin   VARCHAR(100),
    status              VARCHAR(20),           -- active, discontinued, seasonal, pending
    launch_date         DATE,
    discontinue_date    DATE,
    created_at          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    updated_at          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

INSERT INTO dim_products VALUES
('PRD-001','SKU-ELEC-4401','Industrial Control PCB','Printed circuit board for industrial automation controllers','Electronics','PCBs','TechCore','each',42.50,110.00,0.2200,15.00,10.00,2.00,300.00,FALSE,FALSE,NULL,500,1000,250,'SUP-006','8534.10','Taiwan','active','2021-03-01',NULL,CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP()),
('PRD-002','SKU-MECH-2201','Stainless Steel Bearing 6205','Deep groove ball bearing, stainless steel, 25x52x15mm','Mechanical','Bearings','BearPro','each',4.80,14.00,0.0700,5.20,5.20,1.50,40.56,FALSE,FALSE,NULL,2000,5000,1000,'SUP-002','8482.10','Germany','active','2020-01-01',NULL,CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP()),
('PRD-003','SKU-RAW-1101','Aluminum Alloy 6061-T6 Sheet 4x8ft','Raw aluminum sheet, 3mm thick, alloy 6061-T6','Raw Materials','Metals','PacificMet','kg',3.20,5.50,1.0000,122.00,244.00,0.30,8932.80,FALSE,FALSE,NULL,10000,20000,5000,'SUP-011','7606.12','Australia','active','2020-06-01',NULL,CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP()),
('PRD-004','SKU-CHEM-3301','Industrial Epoxy Resin 25L','Two-part epoxy resin for structural bonding, 25L drum','Chemicals','Adhesives','SigmaChem','liter',18.00,42.00,28.0000,35.00,35.00,45.00,55125.00,TRUE,FALSE,730,200,500,100,'SUP-009','3907.30','India','active','2022-02-01',NULL,CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP()),
('PRD-005','SKU-PACK-5501','Corrugated Box 30x20x20cm','Single-wall corrugated shipping box, 32 ECT rated','Packaging','Boxes','EcoPack','each',0.45,1.20,0.2500,30.00,20.00,20.00,12000.00,FALSE,FALSE,NULL,5000,20000,2500,'SUP-007','4819.10','Netherlands','active','2021-01-01',NULL,CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP()),
('PRD-006','SKU-ELEC-4402','DC Motor Driver Board 12A','Motor driver module, 12A continuous, PWM control, 6-30V','Electronics','Motor Control','TechCore','each',28.00,72.00,0.1800,12.00,8.00,2.50,240.00,FALSE,FALSE,NULL,300,600,150,'SUP-006','8537.10','Taiwan','active','2022-05-01',NULL,CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP()),
('PRD-007','SKU-MECH-2202','Carbon Steel Hex Bolt M12x50','Grade 8.8 hex bolt, M12x50mm, zinc plated','Mechanical','Fasteners','NordicParts','each',0.32,0.95,0.0540,5.00,1.20,1.20,7.20,FALSE,FALSE,NULL,10000,50000,5000,'SUP-002','7318.15','Germany','active','2020-01-01',NULL,CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP()),
('PRD-008','SKU-RAW-1102','Polypropylene Pellets 25kg Bag','Food-grade PP homopolymer, MFI 12, natural color','Raw Materials','Polymers','GlobalTech','kg',1.65,3.10,25.0000,50.00,35.00,20.00,35000.00,FALSE,FALSE,NULL,5000,15000,2500,'SUP-001','3902.10','China','active','2021-08-01',NULL,CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP()),
('PRD-009','SKU-ELEC-4403','IoT Gateway Module 4G/WiFi','Industrial IoT gateway, 4G LTE + WiFi, -40°C to 70°C','Electronics','IoT Devices','TechCore','each',85.00,220.00,0.4500,14.00,10.00,3.50,490.00,FALSE,FALSE,NULL,100,200,50,'SUP-006','8517.62','Taiwan','active','2023-01-01',NULL,CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP()),
('PRD-010','SKU-CHEM-3302','Cutting Fluid Concentrate 200L','Water-soluble metalworking fluid, 200L drum, 10:1 mix ratio','Chemicals','Lubricants','ApexRaw','liter',6.50,15.00,196.0000,58.00,58.00,95.00,319780.00,FALSE,FALSE,365,100,300,50,'SUP-004','3820.00','Brazil','active','2022-09-01',NULL,CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP()),
('PRD-011','SKU-MECH-2203','Pneumatic Cylinder 80mm Bore','Double-acting pneumatic cylinder, 80mm bore, 200mm stroke','Mechanical','Pneumatics','NordicParts','each',62.00,145.00,1.8000,28.00,12.00,12.00,4032.00,FALSE,FALSE,NULL,150,300,75,'SUP-002','8412.21','Germany','active','2020-03-01',NULL,CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP()),
('PRD-012','SKU-PACK-5502','Bubble Wrap Roll 50m','1.2m wide, 10mm bubble, perforated every 30cm','Packaging','Protective','EcoPack','each',22.00,48.00,4.5000,120.00,12.00,12.00,17280.00,FALSE,FALSE,NULL,200,500,100,'SUP-007','3926.90','Netherlands','active','2021-01-01',NULL,CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP()),
('PRD-013','SKU-ELEC-4404','Power Supply 24VDC 10A','DIN-rail mount SMPS, 24V 10A 240W output, CE/UL listed','Electronics','Power','GlobalTech','each',38.00,95.00,0.9800,22.50,10.00,12.00,2700.00,FALSE,FALSE,NULL,200,400,100,'SUP-001','8504.40','China','active','2021-06-01',NULL,CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP()),
('PRD-014','SKU-RAW-1103','Copper Wire 2.5mm² 100m Reel','Bare copper conductor, 2.5mm², 100m reel','Raw Materials','Conductors','GlobalTech','each',68.00,145.00,22.0000,30.00,30.00,10.00,9000.00,FALSE,FALSE,NULL,500,1000,250,'SUP-001','8544.11','China','active','2020-01-01',NULL,CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP()),
('PRD-015','SKU-MECH-2204','Linear Guide Rail 1000mm','Hiwin-compatible HGR20 linear guide rail, 1000mm','Mechanical','Linear Motion','NordicParts','each',48.00,120.00,2.4000,100.00,4.40,3.00,1320.00,FALSE,FALSE,NULL,100,200,50,'SUP-002','8466.20','Germany','active','2022-11-01',NULL,CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP());


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. DIM_WAREHOUSES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE TABLE dim_warehouses (
    warehouse_id            VARCHAR(20)  NOT NULL PRIMARY KEY,
    warehouse_name          VARCHAR(200) NOT NULL,
    warehouse_type          VARCHAR(50),          -- distribution, manufacturing, fulfillment, cold_storage, 3pl
    country                 VARCHAR(100),
    region                  VARCHAR(100),
    city                    VARCHAR(100),
    address                 VARCHAR(300),
    zip_code                VARCHAR(20),
    latitude                DECIMAL(10,6),
    longitude               DECIMAL(10,6),
    total_area_sqft         INT,
    usable_area_sqft        INT,
    total_pallet_capacity   INT,
    current_utilization_pct DECIMAL(5,2),
    temperature_controlled  BOOLEAN DEFAULT FALSE,
    temp_min_celsius        DECIMAL(5,1),
    temp_max_celsius        DECIMAL(5,1),
    hazmat_approved         BOOLEAN DEFAULT FALSE,
    manager_name            VARCHAR(100),
    manager_email           VARCHAR(150),
    operating_hours         VARCHAR(100),
    status                  VARCHAR(20),           -- active, inactive, under_maintenance
    created_at              TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

INSERT INTO dim_warehouses VALUES
('WH-001','Chicago Central DC','distribution','USA','North America','Chicago','2400 W Lake St, Chicago IL 60612','60612',41.886300,-87.669200,250000,220000,8500,72.4,FALSE,NULL,NULL,TRUE,'Tom Bradley','t.bradley@company.com','Mon-Sun 06:00-22:00','active',CURRENT_TIMESTAMP()),
('WH-002','Los Angeles Fulfillment Hub','fulfillment','USA','North America','Los Angeles','9800 Aviation Blvd, Inglewood CA 90301','90301',33.956200,-118.364800,180000,165000,6000,85.1,FALSE,NULL,NULL,FALSE,'Maria Gonzalez','m.gonzalez@company.com','24/7','active',CURRENT_TIMESTAMP()),
('WH-003','Dallas Distribution Center','distribution','USA','North America','Dallas','8900 Logistics Blvd, Dallas TX 75247','75247',32.830400,-96.985600,300000,270000,10200,61.8,FALSE,NULL,NULL,TRUE,'James Miller','j.miller@company.com','Mon-Sat 05:00-23:00','active',CURRENT_TIMESTAMP()),
('WH-004','New York Metro Hub','fulfillment','USA','North America','Newark','100 Port Terminal Blvd, Newark NJ 07114','07114',40.693000,-74.160000,120000,105000,3800,91.2,FALSE,NULL,NULL,FALSE,'Priya Shah','p.shah@company.com','24/7','active',CURRENT_TIMESTAMP()),
('WH-005','Seattle Cold Storage','cold_storage','USA','North America','Seattle','1600 E Marginal Way S, Seattle WA 98134','98134',47.575200,-122.336400,80000,72000,2400,55.3,TRUE,-18.0,4.0,FALSE,'Kevin OBrien','k.obrien@company.com','Mon-Sun 06:00-20:00','active',CURRENT_TIMESTAMP()),
('WH-006','Toronto Logistics Center','distribution','Canada','North America','Toronto','200 Midwest Rd, Scarborough ON M1P 4Y9','M1P4Y9',43.747700,-79.294300,140000,125000,4600,68.9,FALSE,NULL,NULL,TRUE,'Rachel Thompson','r.thompson@company.ca','Mon-Fri 07:00-19:00','active',CURRENT_TIMESTAMP()),
('WH-007','Frankfurt European DC','distribution','Germany','Europe','Frankfurt','Cargo City Süd, 60549 Frankfurt am Main','60549',50.049400,8.583000,210000,190000,7200,77.6,FALSE,NULL,NULL,TRUE,'Hans Bauer','h.bauer@company.de','Mon-Sun 05:00-23:00','active',CURRENT_TIMESTAMP()),
('WH-008','Singapore Asia Hub','distribution','Singapore','Asia-Pacific','Singapore','15 Pioneer Rd N, Singapore 628462','628462',1.313900,103.706600,160000,145000,5400,83.4,TRUE,15.0,25.0,TRUE,'Li Wei','l.wei@company.sg','+65 Mon-Sun 24/7','active',CURRENT_TIMESTAMP()),
('WH-009','Mexico City Regional WH','distribution','Mexico','North America','Mexico City','Blvd. Puerto Aéreo 390, Col. Moctezuma, CDMX 15500','15500',19.437200,-99.072600,95000,85000,3200,58.7,FALSE,NULL,NULL,FALSE,'Alejandro Cruz','a.cruz@company.mx','Mon-Sat 07:00-21:00','active',CURRENT_TIMESTAMP()),
('WH-010','Shanghai Manufacturing WH','manufacturing','China','Asia-Pacific','Shanghai','88 Xinzhen Rd, Qingpu District, Shanghai 201707','201707',31.150900,121.092000,320000,290000,11000,79.8,FALSE,NULL,NULL,TRUE,'Chen Jing','c.jing@company.cn','24/7','active',CURRENT_TIMESTAMP()),
('WH-011','Miami Port Facility','3pl','USA','North America','Miami','1015 N America Way, Miami FL 33132','33132',25.778100,-80.178800,70000,62000,2200,44.5,TRUE,2.0,8.0,FALSE,'Sandra Bloom','s.bloom@company.com','24/7','active',CURRENT_TIMESTAMP()),
('WH-012','Atlanta Overflow WH','distribution','USA','North America','Atlanta','2100 Sullivan Rd, College Park GA 30337','30337',33.636900,-84.484900,90000,80000,3000,22.1,FALSE,NULL,NULL,FALSE,'Derek Johnson','d.johnson@company.com','Mon-Fri 08:00-18:00','under_maintenance',CURRENT_TIMESTAMP());


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. DIM_CARRIERS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE TABLE dim_carriers (
    carrier_id          VARCHAR(20)  NOT NULL PRIMARY KEY,
    carrier_name        VARCHAR(200) NOT NULL,
    carrier_type        VARCHAR(50),           -- ocean, air, road, rail, courier, intermodal
    scac_code           VARCHAR(10),           -- Standard Carrier Alpha Code
    country             VARCHAR(100),
    tracking_url        VARCHAR(300),
    service_levels      VARCHAR(200),          -- comma-separated: standard, express, overnight
    hazmat_capable      BOOLEAN DEFAULT FALSE,
    temp_control        BOOLEAN DEFAULT FALSE,
    max_weight_kg       DECIMAL(10,2),
    on_time_rate        DECIMAL(5,2),
    claim_rate          DECIMAL(5,2),          -- % damaged/lost shipments
    avg_transit_days    DECIMAL(5,1),
    cost_per_kg_usd     DECIMAL(8,4),
    account_number      VARCHAR(50),
    status              VARCHAR(20),           -- active, inactive, preferred
    created_at          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

INSERT INTO dim_carriers VALUES
('CAR-001','UPS','courier','UPSN','USA','https://wwwapps.ups.com/tracking/tracking.cgi','standard,express,overnight',TRUE,TRUE,70000.00,95.2,0.4,2.1,5.4200,'1Z-ACC-001','preferred',CURRENT_TIMESTAMP()),
('CAR-002','FedEx','courier','FDXG','USA','https://www.fedex.com/fedextrack/','standard,express,overnight,freight',TRUE,TRUE,999000.00,94.8,0.5,1.8,6.1800,'FX-ACC-002','preferred',CURRENT_TIMESTAMP()),
('CAR-003','DHL Express','courier','DHLC','Germany','https://www.dhl.com/en/express/tracking.html','express,overnight,international',TRUE,FALSE,70000.00,93.5,0.6,3.2,7.8000,'DHL-ACC-003','active',CURRENT_TIMESTAMP()),
('CAR-004','Maersk Line','ocean','MAEU','Denmark','https://www.maersk.com/tracking/','standard,reefer',TRUE,TRUE,NULL,87.1,1.2,25.5,0.1800,'MSK-ACC-004','preferred',CURRENT_TIMESTAMP()),
('CAR-005','Evergreen Marine','ocean','EGLV','Taiwan','https://www.evergreen-line.com/eservice/tracking.do','standard,reefer',FALSE,TRUE,NULL,84.3,1.5,28.0,0.1550,'EVG-ACC-005','active',CURRENT_TIMESTAMP()),
('CAR-006','J.B. Hunt','road','JBHT','USA','https://www.jbhunt.com/tracking/','standard,express,LTL,FTL',TRUE,FALSE,25000.00,91.4,0.7,4.8,1.2400,'JBH-ACC-006','preferred',CURRENT_TIMESTAMP()),
('CAR-007','Werner Enterprises','road','WERN','USA','https://tracking.werner.com/','standard,FTL,temperature',TRUE,TRUE,25000.00,90.8,0.8,5.2,1.1800,'WRN-ACC-007','active',CURRENT_TIMESTAMP()),
('CAR-008','Lufthansa Cargo','air','LACG','Germany','https://lufthansa-cargo.com/en/tracking/shipment-tracking.html','standard,express,priority',TRUE,TRUE,NULL,96.1,0.3,1.2,12.4000,'LHC-ACC-008','active',CURRENT_TIMESTAMP()),
('CAR-009','Amazon Freight','road','AMZL','USA','https://freight.amazon.com/tracking','standard,LTL,FTL',FALSE,FALSE,20000.00,92.3,0.6,3.1,0.9800,'AMZ-ACC-009','active',CURRENT_TIMESTAMP()),
('CAR-010','XPO Logistics','road','XPOL','USA','https://www.xpo.com/tools-resources/tracking/','standard,LTL,FTL,express',TRUE,FALSE,25000.00,89.6,1.1,5.8,1.3200,'XPO-ACC-010','active',CURRENT_TIMESTAMP());


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. DIM_LOCATIONS  (plants, ports, customer sites)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE TABLE dim_locations (
    location_id     VARCHAR(20)  NOT NULL PRIMARY KEY,
    location_name   VARCHAR(200) NOT NULL,
    location_type   VARCHAR(50),          -- plant, port, customer, vendor, hub
    country         VARCHAR(100),
    region          VARCHAR(100),
    city            VARCHAR(100),
    address         VARCHAR(300),
    zip_code        VARCHAR(20),
    latitude        DECIMAL(10,6),
    longitude       DECIMAL(10,6),
    port_code       VARCHAR(10),          -- UN/LOCODE for ports
    timezone        VARCHAR(50),
    status          VARCHAR(20)
);

INSERT INTO dim_locations VALUES
('LOC-001','Shanghai Yangshan Port','port','China','Asia-Pacific','Shanghai','Yangshan Deep Water Port, Pudong','201306',30.623500,122.067900,'CNSHG','Asia/Shanghai','active'),
('LOC-002','Los Angeles/Long Beach Port','port','USA','North America','Los Angeles','Port of Los Angeles, 425 S Palos Verdes St','90731',33.726100,-118.262100,'USLAX','America/Los_Angeles','active'),
('LOC-003','Rotterdam Europort','port','Netherlands','Europe','Rotterdam','Maasvlakte 2, 3199 LC Rotterdam','3199LC',51.940200,4.103700,'NLRTM','Europe/Amsterdam','active'),
('LOC-004','Chicago O\'Hare Cargo Hub','port','USA','North America','Chicago','10000 W O\'Hare Ave, Chicago IL 60666','60666',41.978600,-87.907400,'USORD','America/Chicago','active'),
('LOC-005','Shenzhen Plant A','plant','China','Asia-Pacific','Shenzhen','1800 Longhua Ave, Longhua District','518131',22.683400,113.822000,NULL,'Asia/Shanghai','active'),
('LOC-006','Stuttgart Manufacturing','plant','Germany','Europe','Stuttgart','Industriestrasse 44','70565',48.727700,9.169900,NULL,'Europe/Berlin','active'),
('LOC-007','Dallas Crossdock','hub','USA','North America','Dallas','4500 Hawes Ave, Dallas TX','75203',32.748900,-96.832100,NULL,'America/Chicago','active'),
('LOC-008','Singapore Changi Air Cargo','port','Singapore','Asia-Pacific','Singapore','Cargo Rd, Changi Airport','918111',1.361000,103.989000,'SGSIN','Asia/Singapore','active'),
('LOC-009','Frankfurt Airport Cargo','port','Germany','Europe','Frankfurt','Cargo City Süd, Terminal 1','60549',50.049200,8.582900,'DEFRA','Europe/Berlin','active'),
('LOC-010','Mumbai JNPT Port','port','India','Asia-Pacific','Mumbai','Jawaharlal Nehru Port, Nhava Sheva','400707',18.948700,72.949600,'INNSA','Asia/Kolkata','active');


-- =============================================================================
-- FACT TABLES
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. FACT_PURCHASE_ORDERS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE TABLE fact_purchase_orders (
    po_id                   VARCHAR(30)   NOT NULL PRIMARY KEY,
    po_line_id              VARCHAR(40)   NOT NULL,
    supplier_id             VARCHAR(20),
    product_id              VARCHAR(20),
    warehouse_id            VARCHAR(20),          -- deliver to
    buyer_name              VARCHAR(100),
    po_date                 DATE          NOT NULL,
    requested_delivery_date DATE,
    confirmed_delivery_date DATE,
    actual_delivery_date    DATE,
    status                  VARCHAR(30),           -- draft, submitted, confirmed, partial, received, cancelled, overdue
    quantity_ordered        INT,
    quantity_confirmed      INT,
    quantity_received       INT,
    unit_cost_usd           DECIMAL(12,4),
    line_total_usd          DECIMAL(15,2),
    currency                VARCHAR(10),
    exchange_rate           DECIMAL(10,6),
    line_total_local        DECIMAL(15,2),
    freight_cost_usd        DECIMAL(10,2),
    tax_amount_usd          DECIMAL(10,2),
    total_cost_usd          DECIMAL(15,2),
    payment_terms           VARCHAR(30),
    incoterm                VARCHAR(10),           -- EXW, FOB, CIF, DDP, DAP
    lead_time_days          INT,
    actual_lead_time_days   INT,
    on_time_delivery        BOOLEAN,
    notes                   VARCHAR(500),
    created_at              TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    updated_at              TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

INSERT INTO fact_purchase_orders VALUES
('PO-2026-0001','PO-2026-0001-L1','SUP-006','PRD-001','WH-001','Sarah Chen','2026-01-10','2026-02-15','2026-02-14','2026-02-14','received',2000,2000,2000,42.50,85000.00,'USD',1.000000,85000.00,4200.00,0.00,89200.00,'NET45','FOB',35,35,TRUE,'Regular quarterly order',CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP()),
('PO-2026-0002','PO-2026-0002-L1','SUP-002','PRD-002','WH-007','Sarah Chen','2026-01-15','2026-02-10','2026-02-12','2026-02-15','received',10000,10000,10000,4.80,48000.00,'EUR',1.080000,51840.00,2100.00,7728.00,61668.00,'NET30','CIF',25,31,FALSE,'Delivery delayed 5 days — customs hold',CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP()),
('PO-2026-0003','PO-2026-0003-L1','SUP-001','PRD-008','WH-010','James Wu','2026-01-20','2026-03-20','2026-03-18',NULL,'confirmed',50000,50000,0,1.65,82500.00,'USD',1.000000,82500.00,3800.00,0.00,86300.00,'NET60','FOB',60,NULL,NULL,'Ocean freight, ETA March 18',CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP()),
('PO-2026-0004','PO-2026-0004-L1','SUP-011','PRD-003','WH-001','James Wu','2026-02-01','2026-03-01','2026-03-02','2026-03-05','received',30000,30000,29800,3.20,96000.00,'AUD',0.650000,62400.00,5200.00,0.00,67600.00,'NET45','CIF',28,32,FALSE,'200 units short shipped, supplier to credit',CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP()),
('PO-2026-0005','PO-2026-0005-L1','SUP-007','PRD-005','WH-007','Lisa Park','2026-02-05','2026-02-25','2026-02-25','2026-02-25','received',50000,50000,50000,0.45,22500.00,'EUR',1.080000,24300.00,1800.00,3888.00,30188.00,'NET30','DDP',20,20,TRUE,NULL,CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP()),
('PO-2026-0006','PO-2026-0006-L1','SUP-006','PRD-006','WH-002','Sarah Chen','2026-02-10','2026-03-25','2026-03-28',NULL,'overdue',1500,1500,0,28.00,42000.00,'USD',1.000000,42000.00,3100.00,0.00,45100.00,'NET45','FOB',45,NULL,NULL,'OVERDUE: Supplier production delay — IC shortage',CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP()),
('PO-2026-0007','PO-2026-0007-L1','SUP-002','PRD-011','WH-007','Lisa Park','2026-02-15','2026-03-15','2026-03-14','2026-03-14','received',300,300,300,62.00,18600.00,'EUR',1.080000,20088.00,1200.00,3214.08,25102.08,'NET30','CIF',28,27,TRUE,NULL,CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP()),
('PO-2026-0008','PO-2026-0008-L1','SUP-009','PRD-004','WH-003','Mark Rivera','2026-02-20','2026-03-20','2026-04-10',NULL,'on_hold',500,0,0,18.00,9000.00,'INR',0.012000,108.00,800.00,0.00,9908.00,'NET60','EXW',28,NULL,NULL,'ON HOLD: Supplier quality audit failed — MSDS docs missing',CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP()),
('PO-2026-0009','PO-2026-0009-L1','SUP-006','PRD-009','WH-008','Sarah Chen','2026-03-01','2026-04-15','2026-04-14','2026-04-14','received',200,200,200,85.00,17000.00,'USD',1.000000,17000.00,2400.00,0.00,19400.00,'NET45','FOB',45,44,TRUE,'Air freight — rush order',CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP()),
('PO-2026-0010','PO-2026-0010-L1','SUP-004','PRD-010','WH-003','Mark Rivera','2026-03-05','2026-03-25','2026-03-24','2026-03-25','received',300,300,300,6.50,1950.00,'BRL',0.200000,390.00,280.00,70.20,2700.20,'NET30','DAP',20,21,FALSE,'1 day late, minor',CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP()),
('PO-2026-0011','PO-2026-0011-L1','SUP-001','PRD-013','WH-001','James Wu','2026-03-10','2026-04-30','2026-04-28',NULL,'confirmed',800,800,0,38.00,30400.00,'USD',1.000000,30400.00,2800.00,0.00,33200.00,'NET60','FOB',50,NULL,NULL,'Ocean freight via Shanghai',CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP()),
('PO-2026-0012','PO-2026-0012-L1','SUP-002','PRD-015','WH-007','Lisa Park','2026-03-15','2026-04-12','2026-04-12','2026-04-12','received',200,200,200,48.00,9600.00,'EUR',1.080000,10368.00,800.00,1658.88,12826.88,'NET30','CIF',28,28,TRUE,NULL,CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP()),
('PO-2026-0013','PO-2026-0013-L1','SUP-001','PRD-014','WH-010','James Wu','2026-03-20','2026-05-10','2026-05-08',NULL,'confirmed',1000,1000,0,68.00,68000.00,'USD',1.000000,68000.00,5100.00,0.00,73100.00,'NET60','FOB',51,NULL,NULL,NULL,CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP()),
('PO-2026-0014','PO-2026-0014-L1','SUP-003','PRD-001','WH-002','Sarah Chen','2026-04-01','2026-04-15','2026-04-16','2026-04-17','received',500,500,500,44.00,22000.00,'USD',1.000000,22000.00,1100.00,0.00,23100.00,'NET45','DAP',14,16,FALSE,'Expedited domestic shipment — 2 days late',CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP()),
('PO-2026-0015','PO-2026-0015-L1','SUP-006','PRD-001','WH-008','Sarah Chen','2026-04-15','2026-06-01','2026-05-30',NULL,'submitted',3000,0,0,41.80,125400.00,'USD',1.000000,125400.00,7200.00,0.00,132600.00,'NET45','FOB',47,NULL,NULL,'Q3 buffer stock build',CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP());


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. FACT_INVENTORY
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE TABLE fact_inventory (
    inventory_id            VARCHAR(30)  NOT NULL PRIMARY KEY,
    product_id              VARCHAR(20),
    warehouse_id            VARCHAR(20),
    snapshot_date           DATE         NOT NULL,
    quantity_on_hand        INT,
    quantity_reserved       INT,           -- reserved for open orders
    quantity_available      INT,           -- on_hand - reserved
    quantity_in_transit     INT,           -- ordered, not yet received
    quantity_on_order       INT,           -- open POs
    reorder_point           INT,
    safety_stock            INT,
    days_of_supply          DECIMAL(8,2),  -- qty_available / avg_daily_demand
    avg_daily_demand        DECIMAL(10,2),
    unit_cost_usd           DECIMAL(12,4),
    total_value_usd         DECIMAL(15,2),
    last_movement_date      DATE,
    last_receipt_date       DATE,
    abc_class               VARCHAR(5),    -- A, B, C
    xyz_class               VARCHAR(5),    -- X (stable), Y (variable), Z (erratic)
    slow_moving_flag        BOOLEAN DEFAULT FALSE,
    excess_stock_flag       BOOLEAN DEFAULT FALSE,
    stockout_risk           VARCHAR(10),   -- low, medium, high, critical
    lot_number              VARCHAR(50),
    expiry_date             DATE,
    created_at              TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

INSERT INTO fact_inventory VALUES
('INV-001-WH001','PRD-001','WH-001','2026-05-05',1850,200,1650,0,2000,500,250,22.00,75.00,42.50,78625.00,'2026-05-04','2026-02-14','A','X',FALSE,FALSE,'low',NULL,NULL,CURRENT_TIMESTAMP()),
('INV-001-WH002','PRD-001','WH-002','2026-05-05',420,80,340,500,0,500,250,4.53,75.00,44.00,18480.00,'2026-05-03','2026-04-17','A','X',FALSE,FALSE,'high',NULL,NULL,CURRENT_TIMESTAMP()),
('INV-002-WH001','PRD-002','WH-001','2026-05-05',12400,1000,11400,0,0,2000,1000,456.00,25.00,4.80,59520.00,'2026-05-05','2026-02-15','B','X',FALSE,TRUE,'low',NULL,NULL,CURRENT_TIMESTAMP()),
('INV-002-WH007','PRD-002','WH-007','2026-05-05',8200,500,7700,0,10000,2000,1000,308.00,25.00,5.18,42476.00,'2026-05-02','2026-02-15','B','X',FALSE,TRUE,'low',NULL,NULL,CURRENT_TIMESTAMP()),
('INV-003-WH001','PRD-003','WH-001','2026-05-05',24800,2000,22800,0,30000,10000,5000,182.40,125.00,3.20,79360.00,'2026-05-04','2026-03-05','A','Y',FALSE,FALSE,'low',NULL,NULL,CURRENT_TIMESTAMP()),
('INV-004-WH003','PRD-004','WH-003','2026-05-05',180,20,160,0,500,200,100,32.00,5.00,18.00,3240.00,'2026-04-20','2026-01-15','C','Z',TRUE,FALSE,'medium','LOT-CHEM-2024-04',NULL,CURRENT_TIMESTAMP()),
('INV-005-WH007','PRD-005','WH-007','2026-05-05',38000,5000,33000,0,50000,5000,2500,330.00,100.00,0.45,17100.00,'2026-05-05','2026-02-25','B','X',FALSE,FALSE,'low',NULL,NULL,CURRENT_TIMESTAMP()),
('INV-006-WH002','PRD-006','WH-002','2026-05-05',0,0,0,1500,1500,300,150,0.00,28.00,28.00,0.00,'2026-03-15',NULL,'A','X',FALSE,FALSE,'critical',NULL,NULL,CURRENT_TIMESTAMP()),
('INV-007-WH001','PRD-007','WH-001','2026-05-05',88000,5000,83000,0,0,10000,5000,3320.00,25.00,0.32,28160.00,'2026-05-01','2026-02-15','C','X',FALSE,TRUE,'low',NULL,NULL,CURRENT_TIMESTAMP()),
('INV-008-WH010','PRD-008','WH-010','2026-05-05',42000,3000,39000,0,50000,5000,2500,1560.00,25.00,1.65,69300.00,'2026-05-04','2026-03-01','A','Y',FALSE,FALSE,'low',NULL,NULL,CURRENT_TIMESTAMP()),
('INV-009-WH008','PRD-009','WH-008','2026-05-05',185,30,155,0,200,100,50,7.75,20.00,85.00,15725.00,'2026-05-03','2026-04-14','A','Z',FALSE,FALSE,'medium',NULL,NULL,CURRENT_TIMESTAMP()),
('INV-010-WH003','PRD-010','WH-003','2026-05-05',290,10,280,0,300,100,50,26.15,10.72,6.50,1885.00,'2026-04-28','2026-03-25','C','Y',FALSE,FALSE,'low','LOT-FLUID-2025-11','2026-11-30',CURRENT_TIMESTAMP()),
('INV-011-WH007','PRD-011','WH-007','2026-05-05',420,50,370,0,300,150,75,24.67,15.00,62.00,26040.00,'2026-05-01','2026-03-14','B','X',FALSE,FALSE,'low',NULL,NULL,CURRENT_TIMESTAMP()),
('INV-013-WH001','PRD-013','WH-001','2026-05-05',310,40,270,0,800,200,100,18.00,15.00,38.00,11780.00,'2026-04-25','2026-02-28','A','X',FALSE,FALSE,'medium',NULL,NULL,CURRENT_TIMESTAMP()),
('INV-014-WH010','PRD-014','WH-010','2026-05-05',680,100,580,0,1000,500,250,32.22,18.00,68.00,46240.00,'2026-05-04','2026-02-20','A','X',FALSE,FALSE,'low',NULL,NULL,CURRENT_TIMESTAMP()),
('INV-015-WH007','PRD-015','WH-007','2026-05-05',380,20,360,0,200,100,50,36.00,10.00,48.00,18240.00,'2026-05-02','2026-04-12','B','Y',FALSE,FALSE,'low',NULL,NULL,CURRENT_TIMESTAMP());


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. FACT_SHIPMENTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE TABLE fact_shipments (
    shipment_id             VARCHAR(30)   NOT NULL PRIMARY KEY,
    po_id                   VARCHAR(30),
    carrier_id              VARCHAR(20),
    origin_location_id      VARCHAR(20),
    destination_location_id VARCHAR(20),
    destination_warehouse_id VARCHAR(20),
    shipment_mode           VARCHAR(20),          -- ocean, air, road, rail
    service_level           VARCHAR(30),          -- standard, express, overnight, freight
    tracking_number         VARCHAR(100),
    bill_of_lading          VARCHAR(100),
    container_number        VARCHAR(50),
    ship_date               DATE,
    estimated_arrival_date  DATE,
    actual_arrival_date     DATE,
    status                  VARCHAR(30),          -- booked, in_transit, customs, delivered, delayed, exception
    quantity_shipped        INT,
    gross_weight_kg         DECIMAL(12,4),
    volume_cbm              DECIMAL(10,4),        -- cubic meters
    freight_cost_usd        DECIMAL(12,2),
    insurance_usd           DECIMAL(10,2),
    duties_and_taxes_usd    DECIMAL(10,2),
    total_landed_cost_usd   DECIMAL(15,2),
    incoterm                VARCHAR(10),
    transit_days_planned    INT,
    transit_days_actual     INT,
    on_time                 BOOLEAN,
    delay_reason            VARCHAR(300),
    customs_clearance_date  DATE,
    last_event              VARCHAR(200),
    last_event_ts           TIMESTAMP_NTZ,
    created_at              TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

INSERT INTO fact_shipments VALUES
('SHP-2026-0001','PO-2026-0001','CAR-004','LOC-001','LOC-002','WH-001','ocean','standard','MAEU-B8812934','BL-SHP-001','MSKU-2281934-7','2026-01-12','2026-02-12','2026-02-14','delivered',2000,484.00,2.8800,4200.00,210.00,0.00,89200.00,'FOB',31,33,FALSE,'Port congestion at USLAX, 2-day delay','2026-02-13','Delivered to WH-001','2026-02-14 14:22:00',CURRENT_TIMESTAMP()),
('SHP-2026-0002','PO-2026-0002','CAR-003','LOC-006','LOC-009','WH-007','road','standard','DHL-4421-8832','BL-SHP-002',NULL,'2026-01-18','2026-02-10','2026-02-15','delivered',10000,700.00,17.5000,2100.00,52.00,7728.00,61668.00,'CIF',23,28,FALSE,'Customs hold Frankfurt — documentation review','2026-02-14','Delivered to WH-007','2026-02-15 09:10:00',CURRENT_TIMESTAMP()),
('SHP-2026-0003','PO-2026-0003','CAR-004','LOC-001','LOC-002','WH-010','ocean','standard','MAEU-C9912005','BL-SHP-003','TEMU-8812930-1','2026-01-25','2026-03-18',NULL,'in_transit',50000,1250.00,50.0000,3800.00,190.00,0.00,86300.00,'FOB',52,NULL,NULL,NULL,NULL,'In transit — ETA 2026-03-18','2026-02-20 08:00:00',CURRENT_TIMESTAMP()),
('SHP-2026-0004','PO-2026-0004','CAR-005','LOC-001','LOC-003','WH-007','ocean','standard','EGLV-7712018','BL-SHP-004','EGHU-4491022-3','2026-02-02','2026-03-02','2026-03-05','delivered',29800,29800.00,30.0000,5200.00,260.00,0.00,67600.00,'CIF',28,31,FALSE,'Vessel schedule change, arrived 3 days late','2026-03-04','Delivered to WH-007 — short 200 units','2026-03-05 11:44:00',CURRENT_TIMESTAMP()),
('SHP-2026-0005','PO-2026-0005','CAR-006','LOC-006','LOC-007','WH-007','road','standard','JBH-5531-2290','BL-SHP-005',NULL,'2026-02-07','2026-02-25','2026-02-25','delivered',50000,12500.00,100.0000,1800.00,24.00,3888.00,30188.00,'DDP',18,18,TRUE,NULL,'2026-02-24','Delivered to WH-007','2026-02-25 15:30:00',CURRENT_TIMESTAMP()),
('SHP-2026-0006','PO-2026-0006','CAR-004','LOC-001','LOC-002','WH-002','ocean','standard','MAEU-D1020834',NULL,NULL,NULL,NULL,NULL,'booked',1500,270.00,1.8000,3100.00,155.00,0.00,45100.00,'FOB',45,NULL,NULL,'NOT YET SHIPPED — Supplier production delayed due to IC shortage',NULL,'Booking confirmed, awaiting cargo','2026-04-01 10:00:00',CURRENT_TIMESTAMP()),
('SHP-2026-0007','PO-2026-0007','CAR-003','LOC-006','LOC-009','WH-007','road','express','DHL-4421-9910','BL-SHP-007',NULL,'2026-02-17','2026-03-14','2026-03-14','delivered',300,540.00,0.9000,1200.00,16.00,3214.08,25102.08,'CIF',25,25,TRUE,NULL,'2026-03-13','Delivered to WH-007','2026-03-14 13:20:00',CURRENT_TIMESTAMP()),
('SHP-2026-0009','PO-2026-0009','CAR-008','LOC-001','LOC-008','WH-008','air','express','LHC-AIR-2290045','BL-SHP-009',NULL,'2026-03-02','2026-03-04','2026-04-14','delivered',200,90.00,0.0980,2400.00,85.00,0.00,19400.00,'FOB',44,44,TRUE,NULL,'2026-04-13','Delivered to WH-008','2026-04-14 09:55:00',CURRENT_TIMESTAMP()),
('SHP-2026-0010','PO-2026-0010','CAR-009','LOC-004','LOC-007','WH-003','road','standard','AMZ-889923-01',NULL,NULL,'2026-03-06','2026-03-24','2026-03-25','delivered',300,5880.00,0.9000,280.00,0.00,70.20,2700.20,'DAP',18,19,FALSE,'Driver delay — 1 day',NULL,'Delivered to WH-003','2026-03-25 16:00:00',CURRENT_TIMESTAMP()),
('SHP-2026-0012','PO-2026-0012','CAR-003','LOC-006','LOC-009','WH-007','road','standard','DHL-4421-1102','BL-SHP-012',NULL,'2026-03-17','2026-04-12','2026-04-12','delivered',200,480.00,0.2640,800.00,8.00,1658.88,12826.88,'CIF',26,26,TRUE,NULL,'2026-04-11','Delivered to WH-007','2026-04-12 11:30:00',CURRENT_TIMESTAMP()),
('SHP-2026-0014','PO-2026-0014','CAR-010','LOC-007','LOC-002','WH-002','road','standard','XPO-7712-4491',NULL,NULL,'2026-04-02','2026-04-15','2026-04-17','delivered',500,110.00,1.5000,1100.00,0.00,0.00,23100.00,'DAP',13,15,FALSE,'Driver rerouted — weather delay I-10','2026-04-16','Delivered to WH-002','2026-04-17 08:45:00',CURRENT_TIMESTAMP());


-- ─────────────────────────────────────────────────────────────────────────────
-- 9. FACT_GOODS_RECEIPTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE TABLE fact_goods_receipts (
    receipt_id              VARCHAR(30)  NOT NULL PRIMARY KEY,
    po_id                   VARCHAR(30),
    shipment_id             VARCHAR(30),
    warehouse_id            VARCHAR(20),
    product_id              VARCHAR(20),
    supplier_id             VARCHAR(20),
    receipt_date            DATE         NOT NULL,
    quantity_expected       INT,
    quantity_received       INT,
    quantity_accepted       INT,
    quantity_rejected       INT,
    quantity_shortage       INT,
    shortage_reason         VARCHAR(200),
    condition_on_arrival    VARCHAR(30),         -- good, damaged, partial_damage, rejected
    inspection_status       VARCHAR(30),         -- pending, passed, failed, waived
    inspection_date         DATE,
    inspector_name          VARCHAR(100),
    defect_code             VARCHAR(50),
    defect_description      VARCHAR(300),
    lot_number              VARCHAR(50),
    expiry_date             DATE,
    put_away_location       VARCHAR(100),
    put_away_date           DATE,
    receiver_name           VARCHAR(100),
    notes                   VARCHAR(500),
    created_at              TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

INSERT INTO fact_goods_receipts VALUES
('GR-2026-0001','PO-2026-0001','SHP-2026-0001','WH-001','PRD-001','SUP-006','2026-02-14',2000,2000,2000,0,0,NULL,'good','passed','2026-02-14','David Kim',NULL,NULL,NULL,NULL,'Rack-A12-B03','2026-02-14','Tom Bradley','All units passed inspection',CURRENT_TIMESTAMP()),
('GR-2026-0002','PO-2026-0002','SHP-2026-0002','WH-007','PRD-002','SUP-002','2026-02-15',10000,10000,9850,150,0,NULL,'partial_damage','failed','2026-02-16','Hans Bauer','DMG-CORROSION','150 units show surface corrosion — packaging breach during ocean transit',NULL,NULL,'Rack-C04-D11','2026-02-17','Hans Bauer','150 units quarantined, supplier notified for credit',CURRENT_TIMESTAMP()),
('GR-2026-0004','PO-2026-0004','SHP-2026-0004','WH-007','PRD-003','SUP-011','2026-03-05',30000,29800,29800,0,200,'Carrier short-shipped 200kg — confirmed by shipping manifest','good','passed','2026-03-05','Hans Bauer',NULL,NULL,NULL,NULL,'Block-G01','2026-03-06','Hans Bauer','Supplier to credit 200kg shortage',CURRENT_TIMESTAMP()),
('GR-2026-0005','PO-2026-0005','SHP-2026-0005','WH-007','PRD-005','SUP-007','2026-02-25',50000,50000,50000,0,0,NULL,'good','waived','2026-02-25','Hans Bauer',NULL,NULL,NULL,NULL,'Rack-H10-H15','2026-02-25','Hans Bauer','Trusted supplier — inspection waived per SOP',CURRENT_TIMESTAMP()),
('GR-2026-0007','PO-2026-0007','SHP-2026-0007','WH-007','PRD-011','SUP-002','2026-03-14',300,300,300,0,0,NULL,'good','passed','2026-03-14','Hans Bauer',NULL,NULL,NULL,NULL,'Rack-F03-F05','2026-03-14','Hans Bauer',NULL,CURRENT_TIMESTAMP()),
('GR-2026-0009','PO-2026-0009','SHP-2026-0009','WH-008','PRD-009','SUP-006','2026-04-14',200,200,198,2,0,NULL,'partial_damage','failed','2026-04-14','Li Wei','DMG-PHYSICAL','2 units cracked housing — likely impact during air freight handling',NULL,NULL,'Rack-S02-S04','2026-04-15','Li Wei','2 units rejected, claim filed with LH Cargo',CURRENT_TIMESTAMP()),
('GR-2026-0010','PO-2026-0010','SHP-2026-0010','WH-003','PRD-010','SUP-004','2026-03-25',300,300,300,0,0,NULL,'good','passed','2026-03-26','James Miller',NULL,NULL,'LOT-FLUID-2025-11','2026-11-30','Flammable-Bay-2','2026-03-26','James Miller','Hazmat handling procedures followed',CURRENT_TIMESTAMP()),
('GR-2026-0012','PO-2026-0012','SHP-2026-0012','WH-007','PRD-015','SUP-002','2026-04-12',200,200,200,0,0,NULL,'good','passed','2026-04-12','Hans Bauer',NULL,NULL,NULL,NULL,'Rack-D07-D09','2026-04-12','Hans Bauer',NULL,CURRENT_TIMESTAMP()),
('GR-2026-0014','PO-2026-0014','SHP-2026-0014','WH-002','PRD-001','SUP-003','2026-04-17',500,500,500,0,0,NULL,'good','passed','2026-04-17','Maria Gonzalez',NULL,NULL,NULL,NULL,'Rack-B08-B10','2026-04-17','Maria Gonzalez','Domestic shipment, same-day inspection',CURRENT_TIMESTAMP());


-- ─────────────────────────────────────────────────────────────────────────────
-- 10. FACT_DEMAND_FORECAST
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE TABLE fact_demand_forecast (
    forecast_id         VARCHAR(30)  NOT NULL PRIMARY KEY,
    product_id          VARCHAR(20),
    warehouse_id        VARCHAR(20),
    forecast_date       DATE         NOT NULL,   -- the period being forecast
    forecast_run_date   DATE         NOT NULL,   -- when the forecast was generated
    forecast_method     VARCHAR(50),             -- arima, ml_gradient_boost, moving_avg, manual
    forecast_horizon    VARCHAR(20),             -- weekly, monthly, quarterly
    forecast_qty        INT,
    lower_bound_qty     INT,                     -- 80% confidence interval lower
    upper_bound_qty     INT,                     -- 80% confidence interval upper
    actual_qty          INT,                     -- filled in after the period closes
    forecast_error_pct  DECIMAL(8,4),            -- (actual - forecast) / forecast * 100
    mape                DECIMAL(8,4),            -- Mean Absolute Percentage Error
    bias                DECIMAL(8,4),            -- positive = over-forecast, negative = under-forecast
    demand_signal       VARCHAR(30),             -- stable, trending_up, trending_down, seasonal, volatile
    notes               VARCHAR(300),
    created_at          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

INSERT INTO fact_demand_forecast VALUES
('FC-2026-001','PRD-001','WH-001','2026-03-01','2026-02-15','ml_gradient_boost','monthly',2200,1900,2500,2150,-2.27,2.27,-2.27,'stable',NULL,CURRENT_TIMESTAMP()),
('FC-2026-002','PRD-001','WH-001','2026-04-01','2026-03-15','ml_gradient_boost','monthly',2300,2000,2600,2480,-7.83,7.83,7.83,'trending_up','Strong demand from new industrial customer',CURRENT_TIMESTAMP()),
('FC-2026-003','PRD-001','WH-001','2026-05-01','2026-04-15','ml_gradient_boost','monthly',2500,2100,2900,NULL,NULL,NULL,NULL,'trending_up',NULL,CURRENT_TIMESTAMP()),
('FC-2026-004','PRD-002','WH-007','2026-03-01','2026-02-15','arima','monthly',8000,7000,9000,7800,2.50,2.50,-2.50,'stable',NULL,CURRENT_TIMESTAMP()),
('FC-2026-005','PRD-002','WH-007','2026-04-01','2026-03-15','arima','monthly',8200,7200,9200,NULL,NULL,NULL,NULL,'stable',NULL,CURRENT_TIMESTAMP()),
('FC-2026-006','PRD-005','WH-007','2026-03-01','2026-02-15','moving_avg','monthly',45000,38000,52000,51200,-13.78,13.78,13.78,'seasonal','Packaging demand spikes Q1/Q3',CURRENT_TIMESTAMP()),
('FC-2026-007','PRD-005','WH-007','2026-04-01','2026-03-15','moving_avg','monthly',42000,35000,49000,NULL,NULL,NULL,NULL,'stable',NULL,CURRENT_TIMESTAMP()),
('FC-2026-008','PRD-008','WH-010','2026-03-01','2026-02-15','ml_gradient_boost','monthly',22000,18000,26000,25800,-17.27,17.27,17.27,'trending_up','Factory expansion driving polymer demand up',CURRENT_TIMESTAMP()),
('FC-2026-009','PRD-009','WH-008','2026-03-01','2026-02-15','manual','monthly',180,140,220,200,-11.11,11.11,11.11,'volatile','New product, limited forecast history',CURRENT_TIMESTAMP()),
('FC-2026-010','PRD-013','WH-001','2026-04-01','2026-03-15','arima','monthly',350,280,420,NULL,NULL,NULL,NULL,'stable',NULL,CURRENT_TIMESTAMP()),
('FC-2026-011','PRD-003','WH-001','2026-04-01','2026-03-15','ml_gradient_boost','monthly',28000,23000,33000,NULL,NULL,NULL,NULL,'trending_down','Aluminum substitution project reducing demand',CURRENT_TIMESTAMP()),
('FC-2026-012','PRD-006','WH-002','2026-05-01','2026-04-15','ml_gradient_boost','monthly',1200,900,1500,NULL,NULL,NULL,NULL,'trending_up','Backlog order fulfillment expected after IC shortage resolves',CURRENT_TIMESTAMP());


-- ─────────────────────────────────────────────────────────────────────────────
-- 11. FACT_QUALITY_INSPECTIONS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE TABLE fact_quality_inspections (
    inspection_id       VARCHAR(30)  NOT NULL PRIMARY KEY,
    receipt_id          VARCHAR(30),
    product_id          VARCHAR(20),
    supplier_id         VARCHAR(20),
    warehouse_id        VARCHAR(20),
    inspection_date     DATE,
    inspector_name      VARCHAR(100),
    inspection_type     VARCHAR(50),          -- incoming, in_process, final, audit
    sample_size         INT,
    defects_found       INT,
    defect_rate_pct     DECIMAL(8,4),
    result              VARCHAR(20),          -- passed, failed, conditional
    aql_level           VARCHAR(10),          -- AQL 1.0, 2.5, 4.0
    failure_mode        VARCHAR(100),
    corrective_action   VARCHAR(300),
    supplier_response   VARCHAR(200),
    disposition         VARCHAR(50),          -- accept, reject, rework, sort
    cost_of_poor_quality_usd DECIMAL(12,2),
    photos_attached     BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

INSERT INTO fact_quality_inspections VALUES
('QI-2026-001','GR-2026-0001','PRD-001','SUP-006','WH-001','2026-02-14','David Kim','incoming',200,0,0.00,'passed','AQL 2.5',NULL,NULL,'Accepted — no action','accept',0.00,FALSE,CURRENT_TIMESTAMP()),
('QI-2026-002','GR-2026-0002','PRD-002','SUP-002','WH-007','2026-02-16','Hans Bauer','incoming',500,32,6.40,'failed','AQL 2.5','DMG-CORROSION','Supplier to review packaging spec for ocean transit — VCI bags required','Supplier acknowledged, updating packaging SOP','reject',3840.00,TRUE,CURRENT_TIMESTAMP()),
('QI-2026-003','GR-2026-0004','PRD-003','SUP-011','WH-007','2026-03-05','Hans Bauer','incoming',300,0,0.00,'passed','AQL 4.0',NULL,NULL,'Accepted — no action','accept',0.00,FALSE,CURRENT_TIMESTAMP()),
('QI-2026-004','GR-2026-0007','PRD-011','SUP-002','WH-007','2026-03-14','Hans Bauer','incoming',30,0,0.00,'passed','AQL 1.0',NULL,NULL,'Accepted — precision parts, 100% dimension check','accept',0.00,FALSE,CURRENT_TIMESTAMP()),
('QI-2026-005','GR-2026-0009','PRD-009','SUP-006','WH-008','2026-04-14','Li Wei','incoming',200,2,1.00,'failed','AQL 1.0','DMG-PHYSICAL','File carrier claim, investigate air freight packaging for IoT modules','Supplier reviewing packaging; claim filed with LH Cargo','reject',170.00,TRUE,CURRENT_TIMESTAMP()),
('QI-2026-006','GR-2026-0010','PRD-010','SUP-004','WH-003','2026-03-26','James Miller','incoming',30,0,0.00,'passed','AQL 2.5',NULL,NULL,'COSHH docs verified, hazmat storage confirmed','accept',0.00,FALSE,CURRENT_TIMESTAMP()),
('QI-2026-007','GR-2026-0014','PRD-001','SUP-003','WH-002','2026-04-17','Maria Gonzalez','incoming',50,0,0.00,'passed','AQL 2.5',NULL,NULL,'Spot check passed','accept',0.00,FALSE,CURRENT_TIMESTAMP()),
('QI-2026-008',NULL,'PRD-008','SUP-001','WH-010','2026-03-15','Chen Jing','audit',100,4,4.00,'conditional','AQL 4.0','CONT-CONTAM','4 bags with contamination (black specks) — suspected from blending equipment','Supplier to deep-clean blending line and provide evidence before next order','sort',660.00,TRUE,CURRENT_TIMESTAMP());


-- ─────────────────────────────────────────────────────────────────────────────
-- 12. FACT_RETURNS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE TABLE fact_returns (
    return_id           VARCHAR(30)  NOT NULL PRIMARY KEY,
    po_id               VARCHAR(30),
    receipt_id          VARCHAR(30),
    product_id          VARCHAR(20),
    supplier_id         VARCHAR(20),
    warehouse_id        VARCHAR(20),
    return_type         VARCHAR(30),         -- supplier_return, customer_return, internal_transfer
    return_date         DATE,
    quantity_returned   INT,
    return_reason       VARCHAR(100),        -- defective, wrong_item, over_shipment, not_needed
    return_reason_detail VARCHAR(300),
    unit_cost_usd       DECIMAL(12,4),
    return_value_usd    DECIMAL(12,2),
    credit_memo_number  VARCHAR(50),
    credit_issued_date  DATE,
    credit_amount_usd   DECIMAL(12,2),
    restocking_fee_pct  DECIMAL(5,2),
    disposition         VARCHAR(30),         -- return_to_supplier, scrap, rework, donate
    resolution_status   VARCHAR(30),         -- open, in_progress, closed
    created_at          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

INSERT INTO fact_returns VALUES
('RET-2026-001','PO-2026-0002','GR-2026-0002','PRD-002','SUP-002','WH-007','supplier_return','2026-02-20',150,'defective','150 bearings with surface corrosion — packaging breach in ocean transit. VCI bags not used.',4.80,720.00,'CM-SUP002-2026-003','2026-03-01',720.00,0.00,'return_to_supplier','closed',CURRENT_TIMESTAMP()),
('RET-2026-002','PO-2026-0009','GR-2026-0009','PRD-009','SUP-006','WH-008','supplier_return','2026-04-20',2,'defective','2 IoT gateway modules with cracked housing — air freight impact damage. Claim filed with LH Cargo.',85.00,170.00,'CM-SUP006-2026-007','2026-05-01',170.00,0.00,'return_to_supplier','in_progress',CURRENT_TIMESTAMP()),
('RET-2026-003','PO-2026-0004','GR-2026-0004','PRD-003','SUP-011','WH-007','supplier_return','2026-03-20',200,'over_shipment','Short shipment credit — 200kg not delivered by carrier. Credit issued for difference.',3.20,640.00,'CM-SUP011-2026-002','2026-03-25',640.00,0.00,'return_to_supplier','closed',CURRENT_TIMESTAMP()),
('RET-2026-004',NULL,'QI-2026-008','PRD-008','SUP-001','WH-010','supplier_return','2026-03-18',100,'defective','100kg contaminated PP pellets identified in audit — black specks from unclean blending equipment.',1.65,165.00,'CM-SUP001-2026-005','2026-04-01',165.00,0.00,'scrap','closed',CURRENT_TIMESTAMP());


-- =============================================================================
-- SUMMARY VIEWS
-- =============================================================================

-- Supplier performance scorecard
CREATE OR REPLACE VIEW vw_supplier_scorecard AS
SELECT
    s.supplier_id,
    s.supplier_name,
    s.tier,
    s.country,
    COUNT(DISTINCT po.po_id)                                       AS total_pos,
    SUM(po.total_cost_usd)                                         AS total_spend_usd,
    ROUND(AVG(po.actual_lead_time_days), 1)                        AS avg_lead_time_days,
    ROUND(SUM(CASE WHEN po.on_time_delivery THEN 1 ELSE 0 END)
          / NULLIF(COUNT(CASE WHEN po.on_time_delivery IS NOT NULL THEN 1 END),0) * 100, 1)
                                                                   AS on_time_delivery_pct,
    SUM(po.quantity_received)                                      AS total_units_received,
    SUM(r.quantity_returned)                                       AS total_units_returned,
    ROUND(SUM(r.quantity_returned)
          / NULLIF(SUM(po.quantity_received),0) * 100, 2)          AS return_rate_pct,
    SUM(qi.defects_found)                                          AS total_defects,
    ROUND(AVG(qi.defect_rate_pct), 2)                              AS avg_defect_rate_pct,
    s.reliability_score,
    s.status
FROM dim_suppliers s
LEFT JOIN fact_purchase_orders po  ON s.supplier_id = po.supplier_id
LEFT JOIN fact_returns          r  ON s.supplier_id = r.supplier_id
LEFT JOIN fact_quality_inspections qi ON s.supplier_id = qi.supplier_id
GROUP BY s.supplier_id, s.supplier_name, s.tier, s.country, s.reliability_score, s.status;


-- Inventory health dashboard
CREATE OR REPLACE VIEW vw_inventory_health AS
SELECT
    p.product_id,
    p.product_name,
    p.category,
    i.warehouse_id,
    w.warehouse_name,
    i.abc_class,
    i.quantity_on_hand,
    i.quantity_available,
    i.quantity_in_transit,
    i.quantity_on_order,
    i.reorder_point,
    i.safety_stock,
    i.days_of_supply,
    i.total_value_usd,
    i.stockout_risk,
    i.slow_moving_flag,
    i.excess_stock_flag,
    CASE
        WHEN i.quantity_available = 0 THEN 'STOCKOUT'
        WHEN i.quantity_available <= i.safety_stock THEN 'CRITICAL'
        WHEN i.quantity_available <= i.reorder_point THEN 'REORDER'
        WHEN i.excess_stock_flag THEN 'EXCESS'
        ELSE 'OK'
    END AS inventory_status
FROM fact_inventory i
JOIN dim_products   p ON i.product_id   = p.product_id
JOIN dim_warehouses w ON i.warehouse_id = w.warehouse_id;


-- Active shipment tracker
CREATE OR REPLACE VIEW vw_shipment_tracker AS
SELECT
    sh.shipment_id,
    sh.po_id,
    sh.tracking_number,
    sh.shipment_mode,
    sh.status,
    lo.location_name   AS origin,
    ld.location_name   AS destination,
    c.carrier_name,
    sh.ship_date,
    sh.estimated_arrival_date,
    sh.actual_arrival_date,
    sh.transit_days_planned,
    sh.transit_days_actual,
    sh.on_time,
    DATEDIFF('day', CURRENT_DATE(), sh.estimated_arrival_date) AS days_to_arrival,
    sh.freight_cost_usd,
    sh.total_landed_cost_usd,
    sh.last_event,
    sh.delay_reason
FROM fact_shipments sh
LEFT JOIN dim_carriers  c  ON sh.carrier_id              = c.carrier_id
LEFT JOIN dim_locations lo ON sh.origin_location_id      = lo.location_id
LEFT JOIN dim_locations ld ON sh.destination_location_id = ld.location_id;


-- Open PO dashboard
CREATE OR REPLACE VIEW vw_open_purchase_orders AS
SELECT
    po.po_id,
    po.status,
    s.supplier_name,
    s.country        AS supplier_country,
    p.product_name,
    p.category,
    w.warehouse_name AS destination,
    po.po_date,
    po.requested_delivery_date,
    po.confirmed_delivery_date,
    po.quantity_ordered,
    po.quantity_received,
    po.quantity_ordered - po.quantity_received   AS quantity_outstanding,
    po.total_cost_usd,
    po.incoterm,
    DATEDIFF('day', CURRENT_DATE(), po.confirmed_delivery_date) AS days_to_due,
    CASE
        WHEN po.status = 'overdue' THEN 'OVERDUE'
        WHEN po.status = 'on_hold' THEN 'ON HOLD'
        WHEN DATEDIFF('day', CURRENT_DATE(), po.confirmed_delivery_date) < 0 THEN 'LATE'
        WHEN DATEDIFF('day', CURRENT_DATE(), po.confirmed_delivery_date) <= 7 THEN 'DUE SOON'
        ELSE 'ON TRACK'
    END AS priority_flag
FROM fact_purchase_orders po
JOIN dim_suppliers  s ON po.supplier_id  = s.supplier_id
JOIN dim_products   p ON po.product_id   = p.product_id
JOIN dim_warehouses w ON po.warehouse_id = w.warehouse_id
WHERE po.status NOT IN ('received', 'cancelled');


-- =============================================================================
-- QUICK VALIDATION QUERIES
-- =============================================================================
-- Uncomment and run these after loading to verify counts:

-- SELECT 'dim_suppliers'           AS tbl, COUNT(*) AS rows FROM dim_suppliers           UNION ALL
-- SELECT 'dim_products',                   COUNT(*)        FROM dim_products             UNION ALL
-- SELECT 'dim_warehouses',                 COUNT(*)        FROM dim_warehouses           UNION ALL
-- SELECT 'dim_carriers',                   COUNT(*)        FROM dim_carriers             UNION ALL
-- SELECT 'dim_locations',                  COUNT(*)        FROM dim_locations            UNION ALL
-- SELECT 'fact_purchase_orders',           COUNT(*)        FROM fact_purchase_orders     UNION ALL
-- SELECT 'fact_inventory',                 COUNT(*)        FROM fact_inventory           UNION ALL
-- SELECT 'fact_shipments',                 COUNT(*)        FROM fact_shipments           UNION ALL
-- SELECT 'fact_goods_receipts',            COUNT(*)        FROM fact_goods_receipts      UNION ALL
-- SELECT 'fact_demand_forecast',           COUNT(*)        FROM fact_demand_forecast     UNION ALL
-- SELECT 'fact_quality_inspections',       COUNT(*)        FROM fact_quality_inspections UNION ALL
-- SELECT 'fact_returns',                   COUNT(*)        FROM fact_returns;

-- =============================================================================
-- END OF SCRIPT
-- =============================================================================
