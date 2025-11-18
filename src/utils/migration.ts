import { SorteosService } from '../services/sorteos';
import { UsersService } from '../services/users';
import { CcssConfigService } from '../services/ccss-config';
import {
  MovimientosFondosService,
  MovementAccountKey,
  MovementCurrencyKey,
  MovementStorage,
  MovementStorageState,
} from '../services/movimientos-fondos';
import fs from 'fs';
import path from 'path';

type FondoGeneralMigrationEntry = {
  id: string;
  providerCode: string;
  invoiceNumber: string;
  paymentType: string;
  amountEgreso: number;
  amountIngreso: number;
  manager: string;
  notes?: string;
  createdAt: string;
  accountId?: MovementAccountKey;
  currency?: MovementCurrencyKey;
  isAudit?: boolean;
  originalEntryId?: string;
  auditDetails?: string;
};

const PALMARES_COMPANY_NAME = 'DELIKOR PALMARES';
const PALMARES_COMPANY_ALIASES = ['PALMARES'];
const PALMARES_MOVEMENT_TARGET = 5000;
const PALMARES_MOVEMENT_ID_PREFIX = 'PALMARES-MIG-2025-';
const PALMARES_INGRESO_TYPES = new Set(['VENTAS', 'OTROS INGRESOS']);
const PALMARES_PAYMENT_TYPES: readonly string[] = [
  'VENTAS',
  'OTROS INGRESOS',
  'COMPRA INVENTARIO',
  'SALARIOS',
  'REPARACION EQUIPO',
  'PAGO TIEMPOS',
  'PAGO BANCA',
  'CARGAS SOCIALES',
  'ELECTRICIDAD',
];
const PALMARES_SEED_INTERVAL_MINUTES = 15;

export class MigrationService {

  /**
   * Migrate sorteos from JSON to Firestore
   */
  static async migrateSorteos(): Promise<void> {
    console.log('Starting sorteos migration...');

    try {
      // Load sorteos JSON at runtime if available to avoid build-time module resolution errors
      const sorteosJsonPath = path.resolve(process.cwd(), 'src', 'data', 'sorteos.json');
  let sorteosData: string[] = [];
      if (fs.existsSync(sorteosJsonPath)) {
        try {
          const raw = fs.readFileSync(sorteosJsonPath, 'utf8');
          sorteosData = JSON.parse(raw) as string[];
        } catch (err) {
          console.warn('Could not read or parse sorteos.json:', err);
          sorteosData = [];
        }
      } else {
        console.log('sorteos.json not found, skipping sorteos migration.');
        return;
      }

      // Check if sorteos already exist
      const existingSorteos = await SorteosService.getAllSorteos();
      if (existingSorteos.length > 0) {
        console.log(`Found ${existingSorteos.length} existing sorteos. Skipping migration.`);
        return;
      }

      // Migrate each sorteo
      for (const sorteoName of sorteosData as string[]) {
        const sorteoId = await SorteosService.addSorteo({
          name: sorteoName
        });
        console.log(`Migrated sorteo: ${sorteoName} (ID: ${sorteoId})`);
      }

      console.log(`Successfully migrated ${sorteosData.length} sorteos to Firestore.`);
    } catch (error) {
      console.error('Error migrating sorteos:', error);
      throw error;
    }
  }

  /**
   * Run all migrations
   */
  static async runAllMigrations(): Promise<void> {
    console.log('Starting data migration from JSON to Firestore...');

    try {
      await this.migrateSorteos();
      await this.seedPalmaresFondoGeneralMovements();
      console.log('All migrations completed successfully!');
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  }

  static async seedPalmaresFondoGeneralMovements(): Promise<void> {
    console.log('Starting Fondo General migration for Palmares...');

    const companyName = PALMARES_COMPANY_NAME;
    const preferredDocId = MovimientosFondosService.buildCompanyMovementsKey(companyName);
    const legacyDocIds = PALMARES_COMPANY_ALIASES.map(alias => ({
      company: alias,
      docId: MovimientosFondosService.buildCompanyMovementsKey(alias),
    }));

    const baseStorage =
      (await MovimientosFondosService.getDocument<FondoGeneralMigrationEntry>(preferredDocId)) ??
      (await this.resolvePalmaresLegacyStorage(legacyDocIds)) ??
      MovimientosFondosService.createEmptyMovementStorage<FondoGeneralMigrationEntry>(companyName);

    baseStorage.company = companyName;

    const storage = MovimientosFondosService.ensureMovementStorageShape<FondoGeneralMigrationEntry>(
      baseStorage,
      companyName,
    );

    const existingMovements = Array.isArray(storage.operations?.movements)
      ? [...storage.operations.movements]
      : [];

    const { preservedMovements, removedNet } = this.stripPalmaresSeedMovements(existingMovements);
    const newEntries = this.buildPalmaresSeedMovements();
    const migrationNet = this.calculateNetCRC(newEntries);
    const netDelta = migrationNet - removedNet;

    storage.company = companyName;
    storage.operations = {
      movements: [...preservedMovements, ...newEntries],
    };

    storage.state = this.updatePalmaresLedgerState(storage.state, netDelta);

    await MovimientosFondosService.saveDocument(preferredDocId, storage);
    console.log(`Seeded ${newEntries.length} Fondo General movements for ${companyName}.`);
  }

  private static async resolvePalmaresLegacyStorage(
    legacyDocIds: Array<{ company: string; docId: string }>,
  ): Promise<MovementStorage<FondoGeneralMigrationEntry> | null> {
    for (const legacy of legacyDocIds) {
      const snapshot = await MovimientosFondosService.getDocument<FondoGeneralMigrationEntry>(legacy.docId);
      if (snapshot) {
        console.log(
          `Detected legacy Fondo General document "${legacy.docId}" for company alias "${legacy.company}". Using it as seed base.`,
        );
        snapshot.company = PALMARES_COMPANY_NAME;
        return snapshot;
      }
    }
    return null;
  }

  private static stripPalmaresSeedMovements(
    movements: FondoGeneralMigrationEntry[],
  ): { preservedMovements: FondoGeneralMigrationEntry[]; removedNet: number } {
    let removedNet = 0;
    const preservedMovements: FondoGeneralMigrationEntry[] = [];

    movements.forEach(movement => {
      if (this.isPalmaresSeedMovement(movement)) {
        removedNet += this.movementNetCRC(movement);
        return;
      }
      preservedMovements.push(movement);
    });

    if (removedNet !== 0) {
      console.log('Existing Palmares seed movements detected. They will be replaced.');
    }

    return { preservedMovements, removedNet };
  }

  private static isPalmaresSeedMovement(movement: Partial<FondoGeneralMigrationEntry>): boolean {
    if (!movement) return false;
    const accountMatch = movement.accountId === 'FondoGeneral';
    const idValue = typeof movement.id === 'string' ? movement.id : '';
    return accountMatch && idValue.startsWith(PALMARES_MOVEMENT_ID_PREFIX);
  }

  private static buildPalmaresSeedMovements(): FondoGeneralMigrationEntry[] {
    const entries: FondoGeneralMigrationEntry[] = [];
    const startTimestamp = Date.UTC(2023, 0, 1, 12, 0, 0);

    for (let index = 0; index < PALMARES_MOVEMENT_TARGET; index += 1) {
      const paymentType = PALMARES_PAYMENT_TYPES[index % PALMARES_PAYMENT_TYPES.length];
      const amountBase = 25000 + ((index * 137) % 50000);
      const isIngreso = PALMARES_INGRESO_TYPES.has(paymentType);
      const createdAt = new Date(startTimestamp + index * PALMARES_SEED_INTERVAL_MINUTES * 60 * 1000).toISOString();
      const providerCode = this.buildCompactProviderCode(index);
      const managerCode = this.buildCompactManagerCode(index);

      entries.push({
        id: `${PALMARES_MOVEMENT_ID_PREFIX}${String(index + 1).padStart(4, '0')}`,
        providerCode,
        invoiceNumber: `${((index % 10000) + 1).toString().padStart(4, '0')}`,
        paymentType,
        amountIngreso: isIngreso ? amountBase : 0,
        amountEgreso: isIngreso ? 0 : amountBase,
        manager: managerCode,
        createdAt,
      });
    }

    return entries;
  }

  private static buildCompactProviderCode(index: number): string {
    const normalized = index + 1; // keep deterministic ordering starting at 1
    const base36 = this.toBase36(normalized, 3);
    return `P${base36}`;
  }

  private static buildCompactManagerCode(index: number): string {
    const cycle = (index % 64) + 1;
    const base36 = this.toBase36(cycle, 2);
    return `M${base36}`;
  }

  private static toBase36(value: number, minLength = 1): string {
    const normalized = Math.max(0, Math.floor(value));
    return normalized.toString(36).toUpperCase().padStart(minLength, '0');
  }

  private static calculateNetCRC(entries: Array<Partial<FondoGeneralMigrationEntry>>): number {
    return entries.reduce((acc, entry) => acc + this.movementNetCRC(entry), 0);
  }

  private static movementNetCRC(entry: Partial<FondoGeneralMigrationEntry>): number {
    const ingreso = this.toInteger(entry.amountIngreso);
    const egreso = this.toInteger(entry.amountEgreso);
    return ingreso - egreso;
  }

  private static toInteger(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return Math.trunc(parsed);
    }
    return 0;
  }

  private static updatePalmaresLedgerState(
    state: MovementStorageState | undefined,
    netDeltaCRC: number,
  ): MovementStorageState {
    const fallbackState = MovimientosFondosService.createEmptyMovementStorage<FondoGeneralMigrationEntry>(
      PALMARES_COMPANY_NAME,
    ).state;

    const baseBalances = Array.isArray(state?.balancesByAccount)
      ? [...(state?.balancesByAccount ?? [])]
      : [...fallbackState.balancesByAccount];

    const otherBalances = baseBalances.filter(
      balance => !(balance.accountId === 'FondoGeneral' && balance.currency === 'CRC'),
    );

    const existingBalance = baseBalances.find(
      balance => balance.accountId === 'FondoGeneral' && balance.currency === 'CRC',
    );

    const normalizedBalance =
      existingBalance ??
      fallbackState.balancesByAccount.find(
        balance => balance.accountId === 'FondoGeneral' && balance.currency === 'CRC',
      );

    const mergedBalance = {
      accountId: 'FondoGeneral' as MovementAccountKey,
      currency: 'CRC' as MovementCurrencyKey,
      enabled: normalizedBalance?.enabled ?? true,
      initialBalance: this.toInteger(normalizedBalance?.initialBalance ?? 0),
      currentBalance: this.toInteger(normalizedBalance?.currentBalance ?? 0) + netDeltaCRC,
    };

    return {
      balancesByAccount: [...otherBalances, mergedBalance],
      updatedAt: new Date().toISOString(),
    };
  }
  /**
   * Clear all Firestore data (use with caution!)
   */
  static async clearAllData(): Promise<void> {
    console.log('WARNING: Clearing all Firestore data...');

    try {
      // Clear sorteos
      const sorteos = await SorteosService.getAllSorteos();
      for (const sorteo of sorteos) {
        if (sorteo.id) {
          await SorteosService.deleteSorteo(sorteo.id);
        }
      }
      console.log(`Deleted ${sorteos.length} sorteos.`);      // Clear users
      const users = await UsersService.getAllUsers();
      for (const user of users) {
        if (user.id) {
          await UsersService.deleteUser(user.id);
        }
      }
      console.log(`Deleted ${users.length} users.`);

      // Clear CCSS configuration
      try {
        // We don't delete the CCSS config, just reset it to default values
        await CcssConfigService.updateCcssConfig({
          ownerId: 'default',
          companie: [{
            ownerCompanie: 'default',
            mt: 3672.46,
            tc: 11017.39,
            valorhora: 1441,
            horabruta: 1529.62
          }]
        });
        console.log('CCSS configuration reset to default values.');
      } catch (error) { // eslint-disable-line @typescript-eslint/no-unused-vars
        console.log('CCSS configuration not found or already at defaults.');
      }

      console.log('All Firestore data cleared successfully!');
    } catch (error) {
      console.error('Error clearing Firestore data:', error);
      throw error;
    }
  }
}
