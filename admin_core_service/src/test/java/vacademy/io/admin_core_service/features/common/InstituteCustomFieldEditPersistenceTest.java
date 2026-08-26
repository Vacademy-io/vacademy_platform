package vacademy.io.admin_core_service.features.common;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;
import vacademy.io.admin_core_service.features.common.dto.CustomFieldDTO;
import vacademy.io.admin_core_service.features.common.dto.InstituteCustomFieldDTO;
import vacademy.io.admin_core_service.features.common.entity.CustomFields;
import vacademy.io.admin_core_service.features.common.entity.InstituteCustomField;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;
import vacademy.io.admin_core_service.features.common.repository.CustomFieldRepository;
import vacademy.io.admin_core_service.features.common.repository.InstituteCustomFieldRepository;
import vacademy.io.admin_core_service.features.common.service.InstituteCustomFiledService;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Editing a field that already exists has to reach the master row.
 *
 * <p>A field's definition — its type, its label, its option list — lives only on
 * {@code custom_fields}. When a form editor sends a field it already has, the DTO
 * carries that row's id, and that branch used to load the row and return it
 * untouched: switching a field from TEXT to DROPDOWN, renaming it or editing its
 * options was accepted by the API, reported as saved, and silently discarded.
 * Only the mapping's order survived, which is why reordering looked like it
 * worked while every other edit did not.
 */
class InstituteCustomFieldEditPersistenceTest {

    private InstituteCustomFiledService service;
    private CustomFieldRepository customFieldRepository;
    private InstituteCustomFieldRepository instituteCustomFieldRepository;

    private static final String INSTITUTE_ID = "inst-1";
    private static final String CAMPAIGN_ID = "aud-1";
    private static final String MASTER_ID = "cf-1";

    @BeforeEach
    void setUp() {
        service = new InstituteCustomFiledService();
        customFieldRepository = mock(CustomFieldRepository.class);
        instituteCustomFieldRepository = mock(InstituteCustomFieldRepository.class);

        ReflectionTestUtils.setField(service, "customFieldRepository", customFieldRepository);
        ReflectionTestUtils.setField(service, "instituteCustomFieldRepository", instituteCustomFieldRepository);

        when(customFieldRepository.save(any(CustomFields.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
    }

    private CustomFields masterField(String fieldType, String config) {
        CustomFields master = new CustomFields();
        master.setId(MASTER_ID);
        master.setFieldKey("how_did_you_hear");
        master.setFieldName("How did you hear about us");
        master.setFieldType(fieldType);
        master.setConfig(config);
        master.setFormOrder(7);
        master.setIsMandatory(true);
        master.setStatus(StatusEnum.ACTIVE.name());
        return master;
    }

    private InstituteCustomField existingMapping() {
        InstituteCustomField mapping = new InstituteCustomField();
        mapping.setId("map-1");
        mapping.setInstituteId(INSTITUTE_ID);
        mapping.setCustomFieldId(MASTER_ID);
        mapping.setType("AUDIENCE_FORM");
        mapping.setTypeId(CAMPAIGN_ID);
        mapping.setIndividualOrder(3);
        mapping.setStatus(StatusEnum.ACTIVE.name());
        return mapping;
    }

    private InstituteCustomFieldDTO editDto(CustomFieldDTO customField, Integer individualOrder) {
        InstituteCustomFieldDTO dto = new InstituteCustomFieldDTO();
        dto.setInstituteId(INSTITUTE_ID);
        dto.setType("AUDIENCE_FORM");
        dto.setTypeId(CAMPAIGN_ID);
        dto.setIndividualOrder(individualOrder);
        dto.setCustomField(customField);
        return dto;
    }

    private CustomFieldDTO editedField(String fieldType, String config) {
        CustomFieldDTO cf = new CustomFieldDTO();
        cf.setId(MASTER_ID);
        cf.setFieldKey("how_did_you_hear");
        cf.setFieldName("How did you hear about us");
        cf.setFieldType(fieldType);
        cf.setConfig(config);
        return cf;
    }

    private void stubExistingRows(CustomFields master, InstituteCustomField mapping) {
        when(customFieldRepository.findById(MASTER_ID)).thenReturn(Optional.of(master));
        when(instituteCustomFieldRepository
                .findTopByInstituteIdAndCustomFieldIdAndTypeAndTypeIdAndStatusOrderByCreatedAtDesc(
                        anyString(), anyString(), anyString(), anyString(), anyString()))
                .thenReturn(Optional.of(mapping));
    }

    @Test
    void changingAFieldsTypePersistsToTheMasterRow() {
        CustomFields master = masterField("TEXT", null);
        stubExistingRows(master, existingMapping());

        String options = "[{\"id\":1,\"value\":\"SOCIAL MEDIA\",\"label\":\"SOCIAL MEDIA\"}]";
        service.addOrUpdateCustomField(List.of(editDto(editedField("DROPDOWN", options), 0)));

        ArgumentCaptor<CustomFields> saved = ArgumentCaptor.forClass(CustomFields.class);
        verify(customFieldRepository).save(saved.capture());
        assertEquals("DROPDOWN", saved.getValue().getFieldType());
        assertEquals(options, saved.getValue().getConfig());
    }

    @Test
    void renamingAFieldPersists() {
        CustomFields master = masterField("TEXT", null);
        stubExistingRows(master, existingMapping());

        CustomFieldDTO renamed = editedField("TEXT", "");
        renamed.setFieldName("Where did you hear about us");
        service.addOrUpdateCustomField(List.of(editDto(renamed, 0)));

        ArgumentCaptor<CustomFields> saved = ArgumentCaptor.forClass(CustomFields.class);
        verify(customFieldRepository).save(saved.capture());
        assertEquals("Where did you hear about us", saved.getValue().getFieldName());
    }

    @Test
    void leavingAChoiceTypeClearsTheStaleOptionList() {
        CustomFields master = masterField("DROPDOWN", "[{\"id\":1,\"value\":\"A\",\"label\":\"A\"}]");
        stubExistingRows(master, existingMapping());

        // The editor sends an empty config once the field can no longer show options.
        service.addOrUpdateCustomField(List.of(editDto(editedField("TEXT", ""), 0)));

        ArgumentCaptor<CustomFields> saved = ArgumentCaptor.forClass(CustomFields.class);
        verify(customFieldRepository).save(saved.capture());
        assertEquals("TEXT", saved.getValue().getFieldType());
        assertNull(saved.getValue().getConfig(), "old options would reappear on switching back");
    }

    @Test
    void aCallerThatStatesNoTypeLeavesTheOptionListAlone() {
        String options = "[{\"id\":1,\"value\":\"A\",\"label\":\"A\"}]";
        CustomFields master = masterField("DROPDOWN", options);
        stubExistingRows(master, existingMapping());

        // Some callers send only a label or an order. Silence about the type is not
        // an instruction to throw the options away.
        CustomFieldDTO partial = editedField(null, "");
        service.addOrUpdateCustomField(List.of(editDto(partial, 0)));

        ArgumentCaptor<CustomFields> saved = ArgumentCaptor.forClass(CustomFields.class);
        verify(customFieldRepository).save(saved.capture());
        assertEquals(options, saved.getValue().getConfig());
        assertEquals("DROPDOWN", saved.getValue().getFieldType());
    }

    @Test
    void aSettingsConfigSurvivesAnEditThatDoesNotCarryOne() {
        String settings = "{\"helpText\":\"Upload your CV\",\"maxSizeMB\":5}";
        CustomFields master = masterField("FILE", settings);
        stubExistingRows(master, existingMapping());

        service.addOrUpdateCustomField(List.of(editDto(editedField("FILE", ""), 0)));

        ArgumentCaptor<CustomFields> saved = ArgumentCaptor.forClass(CustomFields.class);
        verify(customFieldRepository).save(saved.capture());
        assertEquals(settings, saved.getValue().getConfig(), "help text and file limits are not options");
    }

    @Test
    void editingAFormDoesNotRewriteRequirednessOnTheSharedRow() {
        CustomFields master = masterField("TEXT", null);
        master.setIsMandatory(false); // this institute accepts email-less leads
        stubExistingRows(master, existingMapping());

        // An editor that force-requires seeded fields (the enroll-invite builder does)
        // must not be able to re-require them for every other form on the institute.
        CustomFieldDTO forced = editedField("TEXT", "");
        forced.setIsMandatory(true);
        InstituteCustomFieldDTO dto = editDto(forced, 0);
        dto.setIsMandatory(true);

        service.addOrUpdateCustomField(List.of(dto));

        ArgumentCaptor<CustomFields> saved = ArgumentCaptor.forClass(CustomFields.class);
        verify(customFieldRepository).save(saved.capture());
        assertEquals(false, saved.getValue().getIsMandatory(),
                "required-ness is per form; the shared row is owned by Settings");

        ArgumentCaptor<List<InstituteCustomField>> mappings = ArgumentCaptor.forClass(List.class);
        verify(instituteCustomFieldRepository).saveAll(mappings.capture());
        assertEquals(true, mappings.getValue().get(0).getIsMandatory(),
                "the per-form answer is kept on the mapping");
    }

    @Test
    void perFormReorderDoesNotTouchTheSharedCatalogOrder() {
        CustomFields master = masterField("TEXT", null);
        InstituteCustomField mapping = existingMapping();
        stubExistingRows(master, mapping);

        CustomFieldDTO moved = editedField("TEXT", "");
        moved.setFormOrder(1); // what a form editor sends for "first on my form"
        service.addOrUpdateCustomField(List.of(editDto(moved, 0)));

        ArgumentCaptor<CustomFields> saved = ArgumentCaptor.forClass(CustomFields.class);
        verify(customFieldRepository).save(saved.capture());
        assertEquals(7, saved.getValue().getFormOrder(),
                "one form must not reshuffle every other form that reuses this field");

        ArgumentCaptor<List<InstituteCustomField>> mappings = ArgumentCaptor.forClass(List.class);
        verify(instituteCustomFieldRepository).saveAll(mappings.capture());
        assertEquals(0, mappings.getValue().get(0).getIndividualOrder(),
                "the per-form position is the mapping's individual_order");
    }

    @Test
    void aShreddedOptionListNeverOverwritesTheStoredOptions() {
        String options = "[{\"id\":1,\"value\":\"SOCIAL MEDIA\",\"label\":\"SOCIAL MEDIA\"},"
                + "{\"id\":2,\"value\":\"WEBSITE\",\"label\":\"WEBSITE\"}]";
        CustomFields master = masterField("MULTI_SELECT", options);
        stubExistingRows(master, existingMapping());

        // What a client that comma-split `options` sends back: each shard of the JSON
        // offered up as an option of its own. On 19 Aug 2026 this reached the DB and
        // turned Vasco Maritime's public lead form into a wall of `[{"id":1` checkboxes.
        String shredded = "[{\"id\":1,\"value\":\"[{\\\"id\\\":1\",\"label\":\"[{\\\"id\\\":1\"},"
                + "{\"id\":2,\"value\":\"\\\"value\\\":\\\"SOCIAL MEDIA\\\"\","
                + "\"label\":\"\\\"value\\\":\\\"SOCIAL MEDIA\\\"\"}]";
        service.addOrUpdateCustomField(List.of(editDto(editedField("MULTI_SELECT", shredded), 0)));

        ArgumentCaptor<CustomFields> saved = ArgumentCaptor.forClass(CustomFields.class);
        verify(customFieldRepository).save(saved.capture());
        assertEquals(options, saved.getValue().getConfig(),
                "shards carry nothing the stored config does not already hold");
    }

    @Test
    void anOrdinaryOptionListStillSaves() {
        CustomFields master = masterField("DROPDOWN", "[{\"id\":1,\"value\":\"A\",\"label\":\"A\"}]");
        stubExistingRows(master, existingMapping());

        // Guarding against shards must not block a real edit — including labels that
        // merely contain punctuation the shard check looks for.
        String edited = "[{\"id\":1,\"value\":\"A\",\"label\":\"A\"},"
                + "{\"id\":2,\"value\":\"Other: {please specify}\",\"label\":\"Other: {please specify}\"}]";
        service.addOrUpdateCustomField(List.of(editDto(editedField("DROPDOWN", edited), 0)));

        ArgumentCaptor<CustomFields> saved = ArgumentCaptor.forClass(CustomFields.class);
        verify(customFieldRepository).save(saved.capture());
        assertEquals(edited, saved.getValue().getConfig());
    }
}
