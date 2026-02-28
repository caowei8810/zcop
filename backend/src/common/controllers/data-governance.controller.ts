import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../modules/auth/decorators/roles.decorator';
import { QdrantService } from '../services/qdrant.service';
import { CasdoorService } from '../services/casdoor.service';
import { DataClassificationService } from '../services/data-classification.service';
import { ComplianceMonitoringService } from '../services/compliance-monitoring.service';
import { DataGovernanceService } from '../services/data-governance.service';

@Controller('api/governance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DataGovernanceController {
  constructor(
    private readonly dataGovernanceService: DataGovernanceService,
    private readonly dataClassificationService: DataClassificationService,
    private readonly complianceMonitoringService: ComplianceMonitoringService,
    private readonly qdrantService: QdrantService,
    private readonly casdoorService: CasdoorService,
  ) {}

  @Get('data-classification')
  @Roles('admin', 'data-steward')
  async getDataClassifications(@Query('entityType') entityType?: string) {
    return this.dataClassificationService.getAllClassifications(entityType);
  }

  @Post('data-classification')
  @Roles('admin', 'data-steward')
  async createDataClassification(@Body() classificationData: any) {
    return this.dataClassificationService.createClassification(classificationData);
  }

  @Put('data-classification/:id')
  @Roles('admin', 'data-steward')
  async updateDataClassification(
    @Param('id') id: string,
    @Body() updateData: any,
  ) {
    return this.dataClassificationService.updateClassification(id, updateData);
  }

  @Delete('data-classification/:id')
  @Roles('admin', 'data-steward')
  async deleteDataClassification(@Param('id') id: string) {
    return this.dataClassificationService.deleteClassification(id);
  }

  @Post('data-classification/auto-classify')
  @Roles('admin', 'data-steward')
  async autoClassifyData(@Body() data: any) {
    return this.dataClassificationService.autoClassifyData(data);
  }

  @Get('compliance-report')
  @Roles('admin', 'compliance-officer')
  async getComplianceReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('reportType') reportType?: string,
  ) {
    const report = await this.complianceMonitoringService.generateComplianceReport({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      reportType: reportType || 'standard',
    });
    
    return report;
  }

  @Post('compliance-check')
  @Roles('admin', 'compliance-officer')
  async runComplianceCheck(@Body() checkData: any) {
    return this.complianceMonitoringService.runComplianceCheck(checkData);
  }

  @Get('privacy-impact-assessment')
  @Roles('admin', 'privacy-officer')
  async getPrivacyImpactAssessment(@Query('entityType') entityType?: string) {
    return this.complianceMonitoringService.getPrivacyImpactAssessment(entityType);
  }

  @Post('privacy-impact-assessment')
  @Roles('admin', 'privacy-officer')
  async runPrivacyImpactAssessment(@Body() assessmentData: any) {
    return this.complianceMonitoringService.runPrivacyImpactAssessment(assessmentData);
  }

  @Get('data-lineage/:entityId')
  @Roles('admin', 'data-steward')
  async getDataLineage(@Param('entityId') entityId: string) {
    return this.dataGovernanceService.getEntityLineage(entityId);
  }

  @Get('data-privacy-controls')
  @Roles('admin', 'privacy-officer')
  async getDataPrivacyControls() {
    return this.complianceMonitoringService.getDataPrivacyControls();
  }

  @Post('data-privacy-controls')
  @Roles('admin', 'privacy-officer')
  async configureDataPrivacyControls(@Body() controls: any) {
    return this.complianceMonitoringService.configureDataPrivacyControls(controls);
  }

  @Post('data-anonymization')
  @Roles('admin', 'data-steward')
  async anonymizeData(@Body() data: any) {
    return this.dataGovernanceService.anonymizeData(data);
  }

  @Get('retention-policy')
  @Roles('admin', 'compliance-officer')
  async getRetentionPolicy(@Query('entityType') entityType?: string) {
    return this.complianceMonitoringService.getRetentionPolicy(entityType);
  }

  @Post('retention-policy')
  @Roles('admin', 'compliance-officer')
  async setRetentionPolicy(@Body() policy: any) {
    return this.complianceMonitoringService.setRetentionPolicy(policy);
  }

  @Get('gdpr-compliance')
  @Roles('admin', 'compliance-officer')
  async getGDPRComplianceStatus() {
    return this.complianceMonitoringService.getGDPRComplianceStatus();
  }

  @Get('ccpa-compliance')
  @Roles('admin', 'compliance-officer')
  async getCCPAComplianceStatus() {
    return this.complianceMonitoringService.getCCPAComplianceStatus();
  }

  @Post('data-breach-report')
  @Roles('admin', 'security-officer')
  async reportDataBreach(@Body() breachData: any) {
    return this.complianceMonitoringService.reportDataBreach(breachData);
  }

  @Get('sensitive-data-discovery')
  @Roles('admin', 'security-officer')
  async discoverSensitiveData(@Query('scanScope') scanScope?: string) {
    return this.dataGovernanceService.discoverSensitiveData(scanScope);
  }

  @Get('data-quality-score/:entityId')
  @Roles('admin', 'data-steward')
  async getDataQualityScore(@Param('entityId') entityId: string) {
    return this.dataGovernanceService.getEntityQualityScore(entityId);
  }

  @Get('data-quality-report')
  @Roles('admin', 'data-steward')
  async getDataQualityReport(
    @Query('entityType') entityType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.dataGovernanceService.getDataQualityReport({
      entityType,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  @Post('data-quality-rule')
  @Roles('admin', 'data-steward')
  async createDataQualityRule(@Body() rule: any) {
    return this.dataGovernanceService.createDataQualityRule(rule);
  }

  @Get('data-quality-rules')
  @Roles('admin', 'data-steward')
  async getDataQualityRules(@Query('entityType') entityType?: string) {
    return this.dataGovernanceService.getDataQualityRules(entityType);
  }

  @Post('data-quality-validation')
  @Roles('admin', 'data-steward')
  async validateDataQuality(@Body() data: any) {
    return this.dataGovernanceService.validateDataQuality(data);
  }

  @Get('export-compliance-data')
  @Roles('admin', 'compliance-officer')
  async exportComplianceData(
    @Res() res: Response,
    @Query('format') format: 'json' | 'csv' | 'pdf' = 'json',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const data = await this.complianceMonitoringService.exportComplianceData({
      format,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    switch (format) {
      case 'csv':
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=compliance-data.csv');
        break;
      case 'pdf':
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=compliance-data.pdf');
        break;
      default:
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=compliance-data.json');
    }

    res.status(HttpStatus.OK).send(data);
  }
}