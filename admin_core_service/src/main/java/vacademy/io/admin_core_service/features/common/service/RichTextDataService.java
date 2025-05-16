package vacademy.io.admin_core_service.features.common.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.common.entity.RichTextData;
import vacademy.io.admin_core_service.features.common.repository.RichTextDataRepository;
import vacademy.io.common.ai.dto.RichTextDataDTO;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class RichTextDataService {
    @Autowired
    private RichTextDataRepository richTextDataRepository;

    public void updateRichTextDataInBulk(List<RichTextDataDTO> richTextDataDTOList) {
        if (richTextDataDTOList == null || richTextDataDTOList.isEmpty()) {
            return;
        }

        // Collect IDs
        List<String> ids = richTextDataDTOList.stream()
                .map(RichTextDataDTO::getId)
                .filter(StringUtils::hasText)
                .toList();

        // Fetch existing RichTextData in bulk
        List<RichTextData> existingRichTexts = richTextDataRepository.findAllById(ids);
        Map<String, RichTextData> richTextDataMap = existingRichTexts.stream()
                .collect(Collectors.toMap(RichTextData::getId, r -> r));

        List<RichTextData> toSave = new ArrayList<>();

        for (RichTextDataDTO dto : richTextDataDTOList) {
            RichTextData richTextData = richTextDataMap.get(dto.getId());
            if (richTextData == null) continue;

            if (StringUtils.hasText(dto.getContent())) {
                richTextData.setContent(dto.getContent());
            }
            if (StringUtils.hasText(dto.getType())) {
                richTextData.setType(dto.getType());
            }

            toSave.add(richTextData);
        }

        if (!toSave.isEmpty()) {
            richTextDataRepository.saveAll(toSave);  // BULK save
        }
    }
}
